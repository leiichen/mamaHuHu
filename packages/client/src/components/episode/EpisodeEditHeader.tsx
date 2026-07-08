// 分集编辑页：顶部导航栏
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { HuyaArtApiKeySettingsButton } from "@/components/home/HuyaArtApiKeySettingsButton";
import { ImageStylePopover } from "@/components/prompt/ImageStylePopover";
import { ModelSelectPopover } from "@/components/prompt/ModelSelectPopover";
import { OutputSettingsPopover } from "@/components/prompt/OutputSettingsPopover";
import { VideoResolutionPopover } from "@/components/prompt/VideoResolutionPopover";
import type { VideoAspectRatioId, VideoResolution } from "@/lib/generationOptions";
import type { ImageStyleId } from "@/lib/imageStyles";

type EpisodeEditHeaderProps = {
    title: string;
    onBack: () => void;
    videoStyleId?: ImageStyleId;
    modelId: string;
    aspectRatio: VideoAspectRatioId;
    videoResolution: VideoResolution;
    onVideoStyleIdChange: (styleId: ImageStyleId | undefined) => void;
    onModelIdChange: (modelId: string) => void;
    onAspectRatioChange: (aspectRatio: VideoAspectRatioId) => void;
    onVideoResolutionChange: (resolution: VideoResolution) => void;
    // onExport 导出整集完整视频
    onExport?: () => void;
    // isExporting 是否导出中
    isExporting?: boolean;
};

// 渲染分集编辑页顶部栏
export function EpisodeEditHeader({
    title,
    onBack,
    videoStyleId,
    modelId,
    aspectRatio,
    videoResolution,
    onVideoStyleIdChange,
    onModelIdChange,
    onAspectRatioChange,
    onVideoResolutionChange,
    onExport,
    isExporting = false,
}: EpisodeEditHeaderProps) {
    return (
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-black/5 bg-[#f5f5f5]/95 px-4 backdrop-blur md:px-6">
            <div className="flex min-w-0 items-center gap-2">
                <button
                    type="button"
                    aria-label="返回"
                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition hover:bg-black/5"
                    onClick={onBack}
                >
                    <ChevronLeft className="size-5" strokeWidth={1.8} />
                </button>
                <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
                <ImageStylePopover
                    popoverPlacement="bottom"
                    panelTitle="视频风格"
                    triggerFallbackLabel="视频风格"
                    value={videoStyleId}
                    onValueChange={onVideoStyleIdChange}
                />
                <ModelSelectPopover
                    mediaType="video"
                    popoverPlacement="bottom"
                    value={modelId}
                    onValueChange={onModelIdChange}
                />
                <OutputSettingsPopover
                    mediaType="video"
                    popoverPlacement="bottom"
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={(nextAspectRatio) =>
                        onAspectRatioChange(nextAspectRatio as VideoAspectRatioId)
                    }
                />
                <VideoResolutionPopover
                    popoverPlacement="bottom"
                    value={videoResolution}
                    onValueChange={onVideoResolutionChange}
                />
                {onExport ? (
                    <button
                        type="button"
                        disabled={isExporting}
                        onClick={onExport}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isExporting ? (
                            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                            <Download className="size-3.5" strokeWidth={1.8} />
                        )}
                        {isExporting ? "导出中..." : "导出"}
                    </button>
                ) : null}
                <HuyaArtApiKeySettingsButton variant="episode" />
            </div>
        </header>
    );
}
