// 项目类型：novel 短剧 | video 短视频（统一定义在 projectSteps，便于一处维护）
export type { ProjectKind } from "./projectSteps";
import type { ProjectKind } from "./projectSteps";

// 短剧项目列表页路径
export function getNovelPagePath() {
    return "/novel";
}

// 短视频项目列表页路径
export function getVideoPagePath() {
    return "/video";
}

// 根据 kind 返回对应 Agent 的列表页路径
export function getAgentListPath(kind: ProjectKind = "novel") {
    return kind === "video" ? getVideoPagePath() : getNovelPagePath();
}

// 项目工作流页路径
export function getProjectPagePath(projectId: number, kind: ProjectKind = "novel") {
    return `/${kind}/project/${projectId}`;
}
