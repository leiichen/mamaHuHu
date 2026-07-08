// 短视频剧情大纲步骤：展示原始创意与剧情大纲（无分集）
import { Loader2, MoreHorizontal, User, XCircle, CheckCircle2, Building2, Clapperboard, FileText, Edit3, Check } from "lucide-react";
import { useState, useMemo } from "react";
import type { CreatedAssetItem } from "@/api/agent";
import { useVideoOutline } from "@/hooks/useVideoOutline";
import { OutlineAccordionItem } from "@/components/project/OutlineAccordionItem";

// OutlineSectionKey 大纲折叠区块标识
type OutlineSectionKey = "source" | "summary" | "assets";

// OutlineJson 大纲 JSON 结构
type OutlineJson = {
    story?: string;
    characters?: string[];
    scenes?: string[];
    segmentPrompts?: Array<{
        scene: string;
        segment: string;
        characters: string[];
        prompts: string[];
    }>;
};

// 尝试从大纲文本中提取结构化 JSON
function tryParseOutlineJson(text: string): OutlineJson | null {
    try {
        const parsed = JSON.parse(text.trim());
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }

    const match = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (match?.[1]) {
        try {
            return JSON.parse(match[1].trim());
        } catch { /* ignore */ }
    }

    return null;
}

// 从 "角色名：描述" 中分离名称与描述
function splitEntry(entry: string): { name: string; desc: string } {
    const idx = entry.indexOf("：") !== -1 ? entry.indexOf("：") : entry.indexOf(":");
    if (idx === -1) return { name: entry, desc: "" };
    return { name: entry.slice(0, idx).trim(), desc: entry.slice(idx + 1).trim() };
}

// 将 prompt 文本中的 @ 引用高亮
const AT_REF_RE = /(@图\d+(?:=\S+)?)/g;
const TIME_SEG_RE = /(\d+-\d+秒[：:])/;

function renderHighlightedText(text: string): React.ReactNode {
    return text.split(AT_REF_RE).map((part, i) =>
        AT_REF_RE.test(part) ? (
            <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-700">{part}</mark>
        ) : (
            part
        ),
    );
}

// 渲染一条 prompt 文本：引用单独一行，@引用高亮，时间段分片单独一行
function renderPrompt(promptText: string): React.ReactNode {
    // 1. 提取引用行：从开头到 "总描述" 或第一个 "@图" 或第一个时间段之前
    let refSection = "";
    let bodyStart = promptText;

    // 找 "总描述：" 的位置
    const 总DescIdx = promptText.search(/总描述[：:]/);
    // 找第一个 @图 的位置（在引用行中）
    const atIdx = promptText.search(/@图\d+/);

    // 引用行结束位置：总描述前一个句号，或 @图 前
    if (总DescIdx > 0 && /^引用/.test(promptText)) {
        // 有引用前缀且后面有总描述
        const refEnd = promptText.slice(0, 总DescIdx);
        bodyStart = promptText.slice(总DescIdx);
    } else if (atIdx > 0 && /^引用/.test(promptText.slice(0, atIdx))) {
        refSection = promptText.slice(0, atIdx);
        bodyStart = promptText.slice(atIdx);
    }

    // 如果引用行没被上面的逻辑提取，尝试用简单方法
    if (!refSection && /^引用/.test(promptText)) {
        const simpleMatch = promptText.match(/^((?:引用(?:角色|场景|关键道具)[：:][^。]*[。.])+)/);
        if (simpleMatch) {
            refSection = simpleMatch[1];
            bodyStart = promptText.slice(refSection.length).replace(/^\s*/, "");
        }
    }

    // 2. 分离 "总描述：" 行与时间段
    let 总DescText = "";
    let timeBody = bodyStart;

    const 总DescMatch = bodyStart.match(/(总描述[：:][^\n]*?)(?=\d+-\d+秒|$)/);
    if (总DescMatch) {
        总DescText = 总DescMatch[1];
        timeBody = bodyStart.slice(总DescMatch[0].length);
    }

    // 3. 按时间段拆分
    const timeSegments = timeBody
        .split(/(?=\d+-\d+秒[：:])/)
        .map((s) => s.trim())
        .filter(Boolean);

    // 如果没有匹配到时间段，把整个 timeBody 作为一个段落
    const fallbackText = !refSection && !总DescText && timeSegments.length === 0
        ? promptText
        : null;

    return (
        <div className="space-y-1.5">
            {refSection ? (
                <div className="rounded-md bg-amber-50/60 px-2 py-1 text-xs text-amber-700">
                    {refSection.split(AT_REF_RE).map((part, i) =>
                        AT_REF_RE.test(part) ? (
                            <mark key={i} className="rounded bg-amber-200 px-0.5 font-medium text-amber-800">{part}</mark>
                        ) : (
                            part
                        ),
                    )}
                </div>
            ) : null}
            {总DescText ? (
                <p className="text-sm leading-6 text-slate-600">
                    {renderHighlightedText(总DescText)}
                </p>
            ) : null}
            {timeSegments.map((seg, i) => {
                const timeMatch = seg.match(TIME_SEG_RE);
                const timeLabel = timeMatch?.[1] ?? "";
                const segBody = timeLabel ? seg.slice(timeLabel.length).trim() : seg;

                return (
                    <div key={`ts-${i}`} className="flex gap-2">
                        <span className="mt-0.5 shrink-0 select-none rounded bg-slate-200 px-1.5 py-px text-[11px] font-medium text-slate-500">
                            {timeLabel.replace(/[：:]$/, "")}
                        </span>
                        <span className="text-sm leading-6 text-slate-600">
                            {renderHighlightedText(segBody)}
                        </span>
                    </div>
                );
            })}
            {fallbackText ? (
                <p className="text-sm leading-6 text-slate-500">{renderHighlightedText(fallbackText)}</p>
            ) : null}
        </div>
    );
}

// 渲染结构化大纲 JSON 视图
function OutlineJsonView({ data }: { data: OutlineJson }) {
    const hasStory = Boolean(data.story?.trim());
    const hasChars = Array.isArray(data.characters) && data.characters.length > 0;
    const hasScenes = Array.isArray(data.scenes) && data.scenes.length > 0;
    const hasSegs = Array.isArray(data.segmentPrompts) && data.segmentPrompts.length > 0;

    return (
        <div className="space-y-5 py-1">
            {hasStory ? (
                <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <FileText className="size-4 text-slate-400" strokeWidth={1.8} />
                        故事概要
                    </h3>
                    <p className="text-sm leading-7 text-slate-600">{data.story}</p>
                </section>
            ) : null}

            {hasChars ? (
                <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <User className="size-4 text-slate-400" strokeWidth={1.8} />
                        角色 ({data.characters!.length})
                    </h3>
                    <div className="space-y-2">
                        {data.characters!.map((entry, i) => {
                            const { name, desc } = splitEntry(entry);
                            return (
                                <div key={`c-${i}`} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5">
                                    <h4 className="mb-0.5 text-sm font-medium text-slate-800">{name}</h4>
                                    <p className="text-sm leading-6 text-slate-500">{desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {hasScenes ? (
                <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <Building2 className="size-4 text-slate-400" strokeWidth={1.8} />
                        场景 ({data.scenes!.length})
                    </h3>
                    <div className="space-y-2">
                        {data.scenes!.map((entry, i) => {
                            const { name, desc } = splitEntry(entry);
                            return (
                                <div key={`s-${i}`} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5">
                                    <h4 className="mb-0.5 text-sm font-medium text-slate-800">{name}</h4>
                                    <p className="text-sm leading-6 text-slate-500">{desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            {hasSegs ? (
                <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <Clapperboard className="size-4 text-slate-400" strokeWidth={1.8} />
                        分镜脚本 ({data.segmentPrompts!.length})
                    </h3>
                    <div className="space-y-2">
                        {data.segmentPrompts!.map((seg, i) => (
                            <div key={`sg-${i}`} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                        {seg.segment}
                                    </span>
                                    <span className="text-xs text-slate-400">{seg.scene}</span>
                                    {seg.characters.length > 0 ? (
                                        <span className="text-xs text-slate-400">· {seg.characters.join("、")}</span>
                                    ) : null}
                                </div>
                                {seg.prompts.map((p, j) => (
                                    <div key={`p-${j}`}>
                                        {renderPrompt(p)}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}

// 渲染单个自动创建资产的状态标签
function AssetStatusBadge({ status, errorMessage }: { status: CreatedAssetItem["imageStatus"]; errorMessage?: string }) {
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
        <span
            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500"
            title={errorMessage ?? ""}
        >
            <XCircle className="size-3" strokeWidth={2} />
            {errorMessage ? `失败: ${errorMessage.slice(0, 20)}` : "生图失败"}
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
                <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                    资产已创建
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-600">
                        <Loader2 className="size-3 animate-spin" strokeWidth={2} />
                        图片后台生成中
                    </span>
                </h3>
                <p className="mb-4 text-xs text-slate-400">角色和场景资产已添加至资产库，图片正在后台生成，稍后刷新即可看到</p>

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
                                        className="flex items-center rounded-lg bg-slate-50 px-3 py-2"
                                    >
                                        <span className="text-sm text-slate-700">{asset.name}</span>
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
                                        className="flex items-center rounded-lg bg-slate-50 px-3 py-2"
                                    >
                                        <span className="text-sm text-slate-700">{asset.name}</span>
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

    // editingCreative 是否正在编辑原始创意
    const [editingCreative, setEditingCreative] = useState(false);
    // creativeDraft 编辑中的创意文本
    const [creativeDraft, setCreativeDraft] = useState("");
    // editingSaving 是否正在保存并重新生成
    const [editingSaving, setEditingSaving] = useState(false);

    const {
        script, loading, generating, confirming, errorMessage,
        createdAssets, retryGenerate, updateCreative, confirmOutline,
    } =
        useVideoOutline({
            projectId,
            onOutlineComplete: onProjectTitleChange,
        });

    // 从大纲文本中提取的原始全文（供展示用）
    const rawOutlineText = useMemo(() => {
        return (
            script?.summaryText ??
            (script?.summary as { text?: string } | null)?.text ??
            ""
        );
    }, [script]);

    // 尝试解析为结构化 JSON，失败则回退为纯文本
    const outlineJsonView = useMemo(() => {
        return tryParseOutlineJson(rawOutlineText);
    }, [rawOutlineText]);

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
                        outlineJsonView ? (
                            <OutlineJsonView data={outlineJsonView} />
                        ) : (
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-600">
                                {rawOutlineText || "暂无大纲内容"}
                            </pre>
                        )
                    ) : null}

                    {!generating &&
                    script?.summaryStatus !== "generating" &&
                    script?.summaryStatus !== "failed" &&
                    script?.summaryStatus !== "completed" ? (
                        <p className="text-sm text-slate-400">等待生成剧情大纲...</p>
                    ) : null}
                </OutlineAccordionItem>
            </div>

            {/* 大纲完成后显示操作按钮：修改创意 / 确认创建资产 */}
            {script?.summaryStatus === "completed" && !editingCreative ? (
                <div className="mx-auto mt-4 flex items-center gap-3">
                    <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                        onClick={() => {
                            setCreativeDraft(script?.source ?? "");
                            setEditingCreative(true);
                        }}
                    >
                        <Edit3 className="size-3.5" strokeWidth={1.8} />
                        修改创意
                    </button>

                    {!createdAssets ? (
                        <button
                            type="button"
                            disabled={confirming}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                            onClick={() => { void confirmOutline(); }}
                        >
                            {confirming ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                                    创建中...
                                </>
                            ) : (
                                <>
                                    <Check className="size-3.5" strokeWidth={2} />
                                    确认，创建资产
                                </>
                            )}
                        </button>
                    ) : createdAssets.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-600">
                            <CheckCircle2 className="size-3.5" strokeWidth={2} />
                            资产已创建
                        </span>
                    ) : null}
                </div>
            ) : null}

            {/* 修改创意编辑区 */}
            {editingCreative ? (
                <div className="mx-auto mt-4 overflow-hidden rounded-3xl bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <textarea
                        value={creativeDraft}
                        onChange={(e) => setCreativeDraft(e.target.value)}
                        className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                        placeholder="输入你构想的短视频创意..."
                        disabled={editingSaving}
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
                            onClick={() => setEditingCreative(false)}
                            disabled={editingSaving}
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            disabled={!creativeDraft.trim() || editingSaving}
                            className="inline-flex cursor-pointer items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                            onClick={async () => {
                                setEditingSaving(true);
                                try {
                                    await updateCreative(creativeDraft.trim());
                                    setEditingCreative(false);
                                } finally {
                                    setEditingSaving(false);
                                }
                            }}
                        >
                            {editingSaving ? (
                                <>
                                    <Loader2 className="mr-1 size-3.5 animate-spin" strokeWidth={2} />
                                    重新生成中...
                                </>
                            ) : (
                                "保存并重新生成"
                            )}
                        </button>
                    </div>
                </div>
            ) : null}

            {createdAssets && createdAssets.length > 0 ? (
                <AssetsCreatedSection createdAssets={createdAssets} />
            ) : null}

            {errorMessage && script?.summaryStatus !== "failed" ? (
                <p className="mt-3 text-xs leading-5 text-red-500">{errorMessage}</p>
            ) : null}
        </div>
    );
}
