// 短视频剧情大纲步骤：展示原始创意与剧情大纲（无分集）
import { Building2, CheckCircle2, Loader2, MoreHorizontal, User, XCircle } from "lucide-react";
import { useState } from "react";
import type { CreatedAssetItem } from "@/api/agent";
import { useVideoOutline } from "@/hooks/useVideoOutline";
import { OutlineAccordionItem } from "@/components/project/OutlineAccordionItem";

// OutlineSectionKey 大纲折叠区块标识
type OutlineSectionKey = "source" | "summary" | "assets";

// 渲染单个自动创建资产的状态标签
function AssetStatusBadge({ status }: { status: CreatedAssetItem["imageStatus"] }) {
    if (status === "completed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3" strokeWidth={2} />
                图片已生成
            </span>
        );
    }

    if (status === "generating") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                <Loader2 className="size-3 animate-spin" strokeWidth={2} />
                生图中...
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500">
            <XCircle className="size-3" strokeWidth={2} />
            生图失败
        </span>
    );
}

// AssetsCreatedSectionProps 自动创建资产区块属性
type AssetsCreatedSectionProps = {
    createdAssets: CreatedAssetItem[];
};

// 渲染自动创建的资产列表
function AssetsCreatedSection({ createdAssets }: AssetsCreatedSectionProps) {
    const characters = createdAssets.filter((asset) => asset.type === "character");
    const scenes = createdAssets.filter((asset) => asset.type === "scene");

    return (
        <div className="mx-auto w-full max-w-[920px] px-4 py-4 md:px-6">
            <div className="rounded-t-3xl bg-white px-6 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <h3 className="mb-4 text-sm font-medium text-slate-800">
                    自动创建资产 · 图片生成中
                </h3>

                <div className="space-y-4">
                    {characters.length > 0 ? (
                        <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                <User className="size-3.5" strokeWidth={1.8} />
                                角色 ({characters.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {characters.map((asset) => (
                                    <div
                                        key={`char-${asset.id}`}
                                        className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                                    >
                                        <span className="text-sm text-slate-700">{asset.name}</span>
                                        <AssetStatusBadge status={asset.imageStatus} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {scenes.length > 0 ? (
                        <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                <Building2 className="size-3.5" strokeWidth={1.8} />
                                场景 ({scenes.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {scenes.map((asset) => (
                                    <div
                                        key={`scene-${asset.id}`}
                                        className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                                    >
                                        <span className="text-sm text-slate-700">{asset.name}</span>
                                        <AssetStatusBadge status={asset.imageStatus} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

// ProjectVideoOutlineStepProps 短视频大纲步骤属性
type ProjectVideoOutlineStepProps = {
    projectId: number;
    onProjectTitleChange?: (title: string) => void;
};

// 渲染短视频剧情大纲步骤内容
export function ProjectVideoOutlineStep({
    projectId,
    onProjectTitleChange,
}: ProjectVideoOutlineStepProps) {
    // expandedSections 当前展开的大纲区块（默认全部收起）
    const [expandedSections, setExpandedSections] = useState<Set<OutlineSectionKey>>(
        () => new Set(),
    );

    const { script, loading, generating, errorMessage, createdAssets, retryGenerate } =
        useVideoOutline({
            projectId,
            onOutlineComplete: onProjectTitleChange,
        });

    // 切换大纲区块展开状态
    const toggleSection = (key: OutlineSectionKey) => {
        setExpandedSections((current) => {
            const next = new Set(current);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    if (loading && !script) {
        return (
            <div className="mx-auto flex min-h-[320px] max-w-[920px] items-center justify-center px-6 py-16 text-sm text-slate-400">
                加载剧情大纲...
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[920px] px-4 py-8 md:px-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-medium text-slate-800">短视频大纲</h2>

                <button
                    type="button"
                    aria-label="更多操作"
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-[#ececf0] text-slate-500 transition hover:bg-[#e2e2e8]"
                >
                    <MoreHorizontal className="size-4" strokeWidth={2} />
                </button>
            </div>

            <div className="overflow-hidden rounded-t-3xl bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <OutlineAccordionItem
                    title="原始创意"
                    expanded={expandedSections.has("source")}
                    onToggle={() => toggleSection("source")}
                >
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {script?.source?.trim() || "暂无原始创意"}
                    </p>
                </OutlineAccordionItem>

                <OutlineAccordionItem
                    title="剧情大纲"
                    expanded={expandedSections.has("summary")}
                    onToggle={() => toggleSection("summary")}
                >
                    {generating || script?.summaryStatus === "generating" ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                            <span>剧情大纲生成中，请稍候...</span>
                        </div>
                    ) : null}

                    {!generating && script?.summaryStatus === "failed" ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm leading-6 text-red-500">
                                {script.params.summaryError ||
                                    errorMessage ||
                                    "剧情大纲生成失败"}
                            </p>
                            <button
                                type="button"
                                onClick={retryGenerate}
                                className="inline-flex h-8 w-fit cursor-pointer items-center rounded-full bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-800"
                            >
                                重新生成
                            </button>
                        </div>
                    ) : null}

                    {script?.summaryStatus === "completed" ? (
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-600">
                            {script.summaryText ??
                                (script.summary as { text?: string } | null)?.text ??
                                "暂无大纲内容"}
                        </pre>
                    ) : null}

                    {!generating &&
                    script?.summaryStatus !== "generating" &&
                    script?.summaryStatus !== "failed" &&
                    script?.summaryStatus !== "completed" ? (
                        <p className="text-sm text-slate-400">等待生成剧情大纲...</p>
                    ) : null}
                </OutlineAccordionItem>
            </div>

            {createdAssets && createdAssets.length > 0 ? (
                <AssetsCreatedSection createdAssets={createdAssets} />
            ) : null}

            {errorMessage && script?.summaryStatus !== "failed" ? (
                <p className="mt-3 text-xs leading-5 text-red-500">{errorMessage}</p>
            ) : null}
        </div>
    );
}
