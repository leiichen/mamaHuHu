// 短视频 Agent 页：创意输入与项目列表
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { VideoHero } from "@/components/video/VideoHero";
import { VideoScriptPanel } from "@/components/video/VideoScriptPanel";
import { NovelProjectSection } from "@/components/novel/NovelProjectSection";
import type { NovelProject } from "@/data/novelProjects";
import { getProjectPagePath } from "@/lib/projectPaths";
import { useRecentProjects } from "@/hooks/useRecentProjects";

// 渲染短视频 Agent 列表页
export function VideoPage() {
    const navigate = useNavigate();
    const {
        projects: myProjects,
        loading,
        errorMessage,
        renameProject,
        deleteProjects,
        deletingProjectIds,
        renamingProjectIds,
    } = useRecentProjects(12, "video");

    // 点击项目卡片进入项目工作流页
    const handleProjectClick = useCallback(
        (project: NovelProject) => {
            if (project.isExample || !/^\d+$/.test(project.id)) {
                return;
            }

            navigate(getProjectPagePath(Number(project.id), "video"));
        },
        [navigate],
    );

    return (
        <div className="relative min-h-full">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 "
            />
            <div className="relative z-[2] mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 pb-16 pt-6 md:px-6 md:pb-20 md:pt-8">
                <VideoHero />
                <VideoScriptPanel />
                <div className="mx-auto flex w-full max-w-[920px] flex-col gap-10 pb-24">
                    <NovelProjectSection
                        title="我的短视频"
                        projects={myProjects}
                        loading={loading}
                        errorMessage={errorMessage}
                        deletingProjectIds={deletingProjectIds}
                        renamingProjectIds={renamingProjectIds}
                        onProjectClick={handleProjectClick}
                        onRenameProject={renameProject}
                        onDeleteProjects={deleteProjects}
                    />
                </div>
            </div>
        </div>
    );
}
