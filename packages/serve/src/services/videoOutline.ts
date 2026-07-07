import {
    extractOutlineText,
    parseVideoOutlineJson,
    runHuyaWorkflow,
    type VideoOutlineJson,
    VIDEO_OUTLINE_INPUT_TEXT_KEY,
} from "../lib/huyaWorkflowClient.js";
import { SUMMARY_STATUS } from "../validators/script.js";
import { scriptService } from "./script.js";
import { assetService } from "./asset.js";
import { seedreamImageService } from "./seedream.js";
import { qiniuService } from "./qiniu.js";
import { buildGenerationPrompt } from "../lib/generationPrompt.js";
import type { SeedreamModelId, SeedreamAspectRatioId, SeedreamResolution } from "../lib/seedreamModels.js";

/**
 * 短视频大纲服务：调用海智 workflow 生成剧情大纲并写回 script.summary
 */

// VideoOutline 短视频剧情大纲（精简结构，仅一段文本）
export type VideoOutline = {
    text: string;
};

// CreatedAssetItem 自动创建的资产项
export type CreatedAssetItem = {
    id: number;
    type: string;
    name: string;
    imageStatus: "generating" | "completed" | "failed";
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
    createdAssets?: CreatedAssetItem[];
};

const VIDEO_OUTLINE_AGENT_ID = "video-outline";
const VIDEO_OUTLINE_AGENT_NAME = "短视频大纲";

// CHARACTER_MODEL_ID 角色生图默认模型
const CHARACTER_MODEL_ID: SeedreamModelId = "seedream-4.5";

// SCENE_MODEL_ID 场景生图默认模型
const SCENE_MODEL_ID: SeedreamModelId = "seedream-4.5";

// CHARACTER_ASPECT_RATIO 角色生图宽高比（竖版全身）
const CHARACTER_ASPECT_RATIO: SeedreamAspectRatioId = "3:4";

// SCENE_ASPECT_RATIO 场景生图宽高比（横版环境）
const SCENE_ASPECT_RATIO: SeedreamAspectRatioId = "16:9";

// DEFAULT_RESOLUTION 默认清晰度
const DEFAULT_RESOLUTION: SeedreamResolution = "2K";

/**
 * 从角色描述中提取角色名称（冒号前的部分）
 * 如 "奶龙：一只圆滚滚的小胖龙..." → "奶龙"
 */
function parseCharacterName(description: string): string {
    const colonIndex = description.indexOf("：");
    if (colonIndex === -1) {
        const colonIndex2 = description.indexOf(":");
        if (colonIndex2 === -1) {
            return description.slice(0, 20).trim();
        }
        return description.slice(0, colonIndex2).trim();
    }
    return description.slice(0, colonIndex).trim();
}

/**
 * 从场景描述中提取场景标识（如 "场景A"）
 * 如 "场景A：午后阳光洒进..." → "场景A"
 */
function parseSceneLabel(description: string): string {
    const colonIndex = description.indexOf("：");
    if (colonIndex === -1) {
        const colonIndex2 = description.indexOf(":");
        if (colonIndex2 === -1) {
            return "场景";
        }
        return description.slice(0, colonIndex2).trim();
    }
    return description.slice(0, colonIndex).trim();
}

/**
 * 为单个资产生成图片：调用 Seedream → 下载 → 上传七牛 → 更新资产 cover
 * @param userId 用户 ID
 * @param assetId 资产 ID
 * @param description 角色/场景描述文本
 * @param assetType 资产分类（character | scene）
 * @returns 是否成功
 */
async function generateAssetImage(
    userId: number,
    assetId: number,
    description: string,
    assetType: "character" | "scene",
): Promise<boolean> {
    try {
        const prompt = buildGenerationPrompt(description, assetType);
        const aspectRatio =
            assetType === "character" ? CHARACTER_ASPECT_RATIO : SCENE_ASPECT_RATIO;
        const modelId =
            assetType === "character" ? CHARACTER_MODEL_ID : SCENE_MODEL_ID;

        // 1. 调用 Seedream 生图
        const result = await seedreamImageService.generateImage({
            prompt,
            modelId,
            aspectRatio,
            resolution: DEFAULT_RESOLUTION,
        });

        const imageUrl = result.images[0]?.url;
        if (!imageUrl) {
            console.error(`[videoOutline] 资产生图未返回图片 assetId=${assetId}`);
            return false;
        }

        // 2. 下载并上传七牛
        let coverKey: string;
        try {
            const uploaded = await qiniuService.uploadFromRemoteUrl(imageUrl, "image");
            coverKey = uploaded.key;
        } catch (uploadError) {
            // 回退：直接用 fetch 下载再上传（部分 CDN 不支持七牛 fetch）
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                console.error(
                    `[videoOutline] 下载生成图片失败 assetId=${assetId}`,
                    imageResponse.status,
                );
                return false;
            }

            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const ext = imageUrl.split(".").pop()?.split("?")[0] ?? "jpg";
            const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
            const uploaded = await qiniuService.uploadBuffer(
                "image",
                imageBuffer,
                ext,
                mimeType,
            );
            coverKey = uploaded.key;
        }

        // 3. 更新资产 cover
        await assetService.updateAssetMedia(userId, assetId, {
            url: "",
            cover: coverKey,
        });

        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[videoOutline] 资产生图失败 assetId=${assetId}:`, message);
        return false;
    }
}

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

            // 尝试解析结构化大纲并自动创建资产
            let createdAssets: CreatedAssetItem[] | undefined;
            const outlineJson = parseVideoOutlineJson(result.outputs);

            if (outlineJson) {
                createdAssets = await this.createAssetsFromOutline(
                    userId,
                    projectId,
                    outlineJson,
                );
            }

            return {
                agentId: VIDEO_OUTLINE_AGENT_ID,
                agentName: VIDEO_OUTLINE_AGENT_NAME,
                outline: { text: outlineText },
                text: outlineText,
                projectId: updated.projectId,
                scriptId: updated.id,
                projectTitle: updated.name,
                ...(createdAssets ? { createdAssets } : {}),
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "短视频大纲生成失败，请稍后重试";

            await scriptService.markSummaryFailed(userId, projectId, message);
            throw error;
        }
    }

    /**
     * 从结构化大纲解析出角色与场景，批量创建资产并并行生图
     * @param userId 当前用户 ID
     * @param projectId 项目 ID
     * @param outlineJson 解析后的结构化大纲
     * @returns 创建的资产列表（含图片生成状态）
     */
    private async createAssetsFromOutline(
        userId: number,
        projectId: number,
        outlineJson: VideoOutlineJson,
    ): Promise<CreatedAssetItem[]> {
        const createdAssets: CreatedAssetItem[] = [];

        // 1. 批量创建角色资产
        for (const characterDesc of outlineJson.characters) {
            const characterName = parseCharacterName(characterDesc);
            try {
                const asset = await assetService.createAssetWithProfile(
                    userId,
                    projectId,
                    "character",
                    characterName,
                    {
                        canvas: {
                            textContent: characterDesc,
                        },
                    },
                );
                createdAssets.push({
                    id: asset.id,
                    type: "character",
                    name: characterName,
                    imageStatus: "generating",
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`[videoOutline] 创建角色资产失败 "${characterName}":`, message);
            }
        }

        // 2. 批量创建场景资产
        for (const sceneDesc of outlineJson.scenes) {
            const sceneLabel = parseSceneLabel(sceneDesc);
            try {
                const asset = await assetService.createAssetWithProfile(
                    userId,
                    projectId,
                    "scene",
                    sceneLabel,
                    {
                        canvas: {
                            textContent: sceneDesc,
                        },
                    },
                );
                createdAssets.push({
                    id: asset.id,
                    type: "scene",
                    name: sceneLabel,
                    imageStatus: "generating",
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`[videoOutline] 创建场景资产失败 "${sceneLabel}":`, message);
            }
        }

        // 3. 并行生成图片（所有资产同时生图，单个失败不影响其他）
        const generationResults = await Promise.allSettled(
            createdAssets.map((asset) =>
                generateAssetImage(
                    userId,
                    asset.id,
                    // 从已创建的资产中查找对应描述文本
                    this.resolveAssetDescription(outlineJson, asset),
                    asset.type as "character" | "scene",
                ),
            ),
        );

        // 4. 更新资产图片生成状态
        createdAssets.forEach((asset, index) => {
            const result = generationResults[index];
            asset.imageStatus =
                result?.status === "fulfilled" && result.value ? "completed" : "failed";
        });

        return createdAssets;
    }

    /**
     * 根据资产类型与名称，从大纲中查找对应描述文本
     */
    private resolveAssetDescription(
        outlineJson: VideoOutlineJson,
        asset: CreatedAssetItem,
    ): string {
        if (asset.type === "character") {
            const found = outlineJson.characters.find(
                (desc) => parseCharacterName(desc) === asset.name,
            );
            return found ?? asset.name;
        }

        const found = outlineJson.scenes.find(
            (desc) => parseSceneLabel(desc) === asset.name,
        );
        return found ?? asset.name;
    }
}

// videoOutlineService 短视频大纲服务单例
export const videoOutlineService = new VideoOutlineService();
