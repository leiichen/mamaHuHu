// 短视频 Agent 剧本生成面板（仅 AI 生大纲）
import { Sparkles } from "lucide-react";
import { VideoAiTabContent } from "@/components/video/VideoAiTabContent";
import { NovelScriptTabButton } from "@/components/novel/NovelScriptTabButton";

// 渲染短视频 Agent 剧本操作面板
export function VideoScriptPanel() {
    return (
        <section className="relative mx-auto w-full max-w-[720px]">
            <div className="xyq-video-tabs mx-auto flex w-full max-w-[720px] max-h-[min(80vh,720px)] flex-col">
                <div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-t-3xl bg-[#d9d9df]">
                    <NovelScriptTabButton
                        label="AI 生大纲"
                        icon={Sparkles}
                        isActive
                        index={0}
                        isFirst
                        isLast
                        hasDivider={false}
                        onClick={() => {}}
                    />
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-b-3xl bg-white p-3">
                    <VideoAiTabContent />
                </div>
            </div>
        </section>
    );
}
