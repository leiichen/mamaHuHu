import {
    extractOutlineText,
    runHuyaWorkflow,
    VIDEO_OUTLINE_INPUT_TEXT_KEY,
} from "../lib/huyaWorkflowClient.js";
import { SUMMARY_STATUS } from "../validators/script.js";
import { scriptService } from "./script.js";

/**
 * 短视频大纲服务：调用海智 workflow 生成剧情大纲并写回 script.summary
 */

// VideoOutline 短视频剧情大纲（精简结构，仅一段文本）
export type VideoOutline = {
    text: string;
};

// VideoOutlineResult 大纲生成完整响应（含持久化后的项目信息）
export type VideoOutlineResult = {
    agentId: string;
    agentName: string;
    outline: VideoOutline;
    text: string;
    projectId: number;
    scriptId: number;
    projectTitle: string;
};

const VIDEO_OUTLINE_AGENT_ID = "video-outline";
const VIDEO_OUTLINE_AGENT_NAME = "短视频大纲";

export class VideoOutlineService {
    /**
     * 为已有剧本草稿调用海智 workflow 生成剧情大纲并写回
     * @param userId 当前用户 ID
     * @param projectId 项目 ID
     */
    async generateOutline(userId: number, projectId: number): Promise<VideoOutlineResult> {
        const script = await scriptService.getByProjectId(userId, projectId);

        if (script.summary && script.summaryStatus === SUMMARY_STATUS.COMPLETED) {
            const text = (script.summary as VideoOutline).text ?? script.summaryText ?? "";

            return {
                agentId: VIDEO_OUTLINE_AGENT_ID,
                agentName: VIDEO_OUTLINE_AGENT_NAME,
                outline: { text },
                text,
                projectId: script.projectId,
                scriptId: script.id,
                projectTitle: script.name,
            };
        }

        if (!script.source?.trim()) {
            throw new Error("原始创意为空，无法生成剧情大纲");
        }

        await scriptService.markSummaryGenerating(userId, projectId);

        try {
            const result = await runHuyaWorkflow({
                inputs: { [VIDEO_OUTLINE_INPUT_TEXT_KEY]: script.source },
                user: String(userId),
            });

            const outlineText = extractOutlineText(result.outputs);

            if (!outlineText.trim()) {
                throw new Error("workflow 未返回有效大纲文本");
            }

            const updated = await scriptService.applyVideoOutline({
                userId,
                projectId,
                outline: { text: outlineText },
                summaryText: outlineText,
            });

            return {
                agentId: VIDEO_OUTLINE_AGENT_ID,
                agentName: VIDEO_OUTLINE_AGENT_NAME,
                outline: { text: outlineText },
                text: outlineText,
                projectId: updated.projectId,
                scriptId: updated.id,
                projectTitle: updated.name,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "短视频大纲生成失败，请稍后重试";

            await scriptService.markSummaryFailed(userId, projectId, message);
            throw error;
        }
    }
}

// videoOutlineService 短视频大纲服务单例
export const videoOutlineService = new VideoOutlineService();
