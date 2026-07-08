// 短视频剧情大纲页数据：拉取详情并在需要时触发大纲生成
import { useCallback, useEffect, useRef, useState } from "react";
import {
    generateVideoOutline,
    confirmVideoOutline,
    type CreatedAssetItem,
} from "@/api/agent";
import { fetchScriptDetail, updateScriptSource, type ScriptDetail } from "@/api/script";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

// POLL_INTERVAL_MS 生成中轮询间隔
const POLL_INTERVAL_MS = 2000;

// UseVideoOutlineOptions 大纲 Hook 配置
type UseVideoOutlineOptions = {
    projectId: number;
    onOutlineComplete?: (projectTitle: string) => void;
};

// 获取剧本详情，并在 pending / failed 时自动触发大纲生成
export function useVideoOutline({ projectId, onOutlineComplete }: UseVideoOutlineOptions) {
    // script 剧本详情
    const [script, setScript] = useState<ScriptDetail | null>(null);
    // loading 是否正在加载详情
    const [loading, setLoading] = useState(true);
    // generating 是否正在生成大纲
    const [generating, setGenerating] = useState(false);
    // errorMessage 错误提示
    const [errorMessage, setErrorMessage] = useState("");
    // createdAssets 用户确认后创建的资产列表
    const [createdAssets, setCreatedAssets] = useState<CreatedAssetItem[] | null>(null);
    // confirming 是否正在确认并创建资产
    const [confirming, setConfirming] = useState(false);
    // confirmingRef 防重复点击（同步更新，比 state 更快）
    const confirmingRef = useRef(false);
    // generateStartedRef 是否已触发过生成，避免重复请求
    const generateStartedRef = useRef(false);
    // onOutlineCompleteRef 完成回调引用
    const onOutlineCompleteRef = useRef(onOutlineComplete);

    useEffect(() => {
        onOutlineCompleteRef.current = onOutlineComplete;
    }, [onOutlineComplete]);

    // 拉取剧本详情
    const loadDetail = useCallback(async () => {
        const detail = await fetchScriptDetail(projectId);
        setScript(detail);
        return detail;
    }, [projectId]);

    // 调用 Agent 生成短视频大纲
    const startGenerate = useCallback(async () => {
        setGenerating(true);
        setErrorMessage("");
        setCreatedAssets(null);

        try {
            const result = await generateVideoOutline({ project_id: projectId });
            const detail = await loadDetail();

            if (detail.summaryStatus === "completed") {
                onOutlineCompleteRef.current?.(result.projectTitle);
            }
        } catch (error) {
            setErrorMessage(getApiErrorMessage(error, "短视频大纲生成失败，请稍后重试"));

            try {
                await loadDetail();
            } catch {
                // 忽略刷新失败
            }
        } finally {
            setGenerating(false);
        }
    }, [loadDetail, projectId]);

    // 重试生成大纲
    const retryGenerate = useCallback(() => {
        generateStartedRef.current = true;
        void startGenerate();
    }, [startGenerate]);

    // 更新原始创意并重新生成大纲
    const updateCreative = useCallback(
        async (newSource: string) => {
            setErrorMessage("");
            try {
                await updateScriptSource({ project_id: projectId, source: newSource });
                generateStartedRef.current = true;
                void startGenerate();
            } catch (error) {
                setErrorMessage(
                    getApiErrorMessage(error, "更新创意失败"),
                );
            }
        },
        [projectId, startGenerate],
    );

    // 用户确认大纲，创建资产并生成图片
    const confirmOutline = useCallback(async () => {
        if (confirmingRef.current || createdAssets !== null) {
            return;
        }
        confirmingRef.current = true;
        setConfirming(true);
        setErrorMessage("");

        try {
            const result = await confirmVideoOutline({ project_id: projectId });

            if (result.createdAssets?.length) {
                setCreatedAssets(result.createdAssets);
            }
        } catch (error) {
            setErrorMessage(
                getApiErrorMessage(error, "资产创建失败，请稍后重试"),
            );
        } finally {
            setConfirming(false);
            confirmingRef.current = false;
        }
    }, [projectId, createdAssets]);

    useEffect(() => {
        generateStartedRef.current = false;
        setScript(null);
        setLoading(true);
        setErrorMessage("");
        setCreatedAssets(null);

        let cancelled = false;

        const bootstrap = async () => {
            try {
                const detail = await fetchScriptDetail(projectId);

                if (cancelled) {
                    return;
                }

                setScript(detail);

                // 如果已确认过，置灰按钮
                if (detail.params.assetsConfirmed) {
                    setCreatedAssets([]);
                }
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(getApiErrorMessage(error, "获取剧本详情失败，请稍后重试"));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [projectId]);

    useEffect(() => {
        if (!script || loading) {
            return;
        }

        if (script.summaryStatus === "completed") {
            return;
        }

        if (script.summaryStatus === "generating") {
            const intervalId = window.setInterval(() => {
                void loadDetail().catch(() => {
                    // 轮询失败时静默忽略
                });
            }, POLL_INTERVAL_MS);

            return () => {
                window.clearInterval(intervalId);
            };
        }

        if (
            (script.summaryStatus === "pending" || script.summaryStatus === "failed") &&
            !generateStartedRef.current
        ) {
            generateStartedRef.current = true;
            void startGenerate();
        }
    }, [loadDetail, loading, script, startGenerate]);

    return {
        script,
        loading,
        generating,
        confirming,
        errorMessage,
        createdAssets,
        retryGenerate,
        updateCreative,
        confirmOutline,
    };
}
