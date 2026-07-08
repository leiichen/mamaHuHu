import { useCallback, useEffect, useState } from "react";
import { pollSerieExport, type PollSerieExportResult } from "@/api/serie";
import {
    readSerieExportTask,
    removeSerieExportTask,
    type SerieExportTaskRecord,
} from "@/lib/serieExportTask";

// POLL_INTERVAL_MS 轮询间隔（毫秒）
const POLL_INTERVAL_MS = 10_000;

type UseSerieExportPollerOptions = {
    projectId: number;
    serieId: number;
    enabled: boolean;
    onSucceeded: (result: PollSerieExportResult["result"]) => void;
    onFailed: (message: string) => void;
};

// 轮询分集导出任务并在终态时回调
export function useSerieExportPoller({
    projectId,
    serieId,
    enabled,
    onSucceeded,
    onFailed,
}: UseSerieExportPollerOptions) {
    // isExporting 是否处于导出中
    const [isExporting, setIsExporting] = useState(false);

    // 轮询单个任务
    const pollTask = useCallback(
        async (task: SerieExportTaskRecord) => {
            try {
                const result = await pollSerieExport({
                    project_id: task.projectId,
                    serie_id: task.serieId,
                    job_id: task.jobId,
                });

                if (result.status === "succeeded") {
                    removeSerieExportTask(task.serieId);
                    setIsExporting(false);
                    onSucceeded(result.result);
                    return;
                }

                if (result.status === "failed") {
                    removeSerieExportTask(task.serieId);
                    setIsExporting(false);
                    onFailed(result.message ?? "导出失败");
                }
            } catch {
                removeSerieExportTask(task.serieId);
                setIsExporting(false);
                onFailed("查询导出进度失败");
            }
        },
        [onFailed, onSucceeded],
    );

    // 执行单次轮询
    const pollOnce = useCallback(async () => {
        const task = readSerieExportTask(serieId);

        if (!task) {
            setIsExporting(false);
            return;
        }

        setIsExporting(true);
        await pollTask(task);
    }, [pollTask, serieId]);

    // 同步 localStorage 状态到 isExporting
    const syncExporting = useCallback(() => {
        setIsExporting(Boolean(readSerieExportTask(serieId)));
    }, [serieId]);

    useEffect(() => {
        if (!enabled || !projectId || !serieId) {
            return;
        }

        syncExporting();
        void pollOnce();

        const timer = window.setInterval(() => {
            void pollOnce();
        }, POLL_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [enabled, pollOnce, projectId, serieId, syncExporting]);

    return {
        isExporting,
        refreshPolling: pollOnce,
    };
}
