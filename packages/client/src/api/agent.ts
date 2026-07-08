import { request } from "@/api/http";

// ScriptSummaryCharacter 单个人物小传
export type ScriptSummaryCharacter = {
    name: string;
    title: string;
    roleType: string;
    visualImage: string;
    coreTags: string;
    identityBackground: string;
    growthExperience: string;
    personality: string;
    relationships: string;
    growthArc: string;
};

// ScriptSummary 结构化剧本摘要
export type ScriptSummary = {
    episodeCount: number;
    storyType: string;
    targetAudience: string;
    coreHook: string;
    oneLineStory: string;
    characters: ScriptSummaryCharacter[];
    synopsis: string;
};

// ScriptSummaryResult 剧本摘要 Agent 响应
export type ScriptSummaryResult = {
    agentId: string;
    agentName: string;
    summary: ScriptSummary;
    text: string;
    projectId: number;
    scriptId: number;
    projectTitle: string;
};

// VideoOutline 短视频剧情大纲（精简结构）
export type VideoOutline = {
    text: string;
};

// CreatedAssetItem 大纲自动创建的资产项
export type CreatedAssetItem = {
    id: number;
    type: string;
    name: string;
    imageStatus: "generating" | "completed" | "failed";
    errorMessage?: string;
};

// VideoOutlineResult 短视频大纲 Agent 响应
export type VideoOutlineResult = {
    agentId: string;
    agentName: string;
    outline: VideoOutline;
    text: string;
    projectId: number;
    scriptId: number;
    projectTitle: string;
    createdAssets?: CreatedAssetItem[];
};

// GenerateScriptSummaryPayload 剧本摘要请求体
export type GenerateScriptSummaryPayload = {
    project_id: number;
};

// 为已有剧本草稿生成结构化摘要
export function generateScriptSummary(payload: GenerateScriptSummaryPayload) {
    return request<ScriptSummaryResult>("/agent/script_summary", {
        method: "POST",
        data: payload,
    });
}

// 为已有剧本草稿调用海智 workflow 生成短视频剧情大纲
export function generateVideoOutline(payload: GenerateScriptSummaryPayload) {
    return request<VideoOutlineResult>("/agent/video_outline", {
        method: "POST",
        data: payload,
    });
}

// 用户确认大纲后，创建角色/场景资产并生成图片
export function confirmVideoOutline(payload: GenerateScriptSummaryPayload) {
    return request<VideoOutlineResult>("/agent/video_outline_confirm", {
        method: "POST",
        data: payload,
    });
}
