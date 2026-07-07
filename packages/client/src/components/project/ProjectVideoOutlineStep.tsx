// 短视频剧情大纲步骤：展示原始创意与剧情大纲（无分集）
import { Loader2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useVideoOutline } from "@/hooks/useVideoOutline";
import { OutlineAccordionItem } from "@/components/project/OutlineAccordionItem";

// OutlineSectionKey 大纲折叠区块标识
type OutlineSectionKey = "source" | "summary";

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

    const { script, loading, generating, errorMessage, retryGenerate } = useVideoOutline({
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

            {errorMessage && script?.summaryStatus !== "failed" ? (
                <p className="mt-3 text-xs leading-5 text-red-500">{errorMessage}</p>
            ) : null}
        </div>
    );
}
