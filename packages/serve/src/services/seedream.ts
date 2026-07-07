import { huyaArtSubmitAndPoll, parseHuyaArtApiError } from "../lib/huyaArtClient.js";
import {
    resolveSeedreamModel,
    resolveSeedreamProvider,
    resolveSeedreamSize,
    resolveSeedreamType,
    type SeedreamAspectRatioId,
    type SeedreamModelId,
    type SeedreamResolution,
} from "../lib/seedreamModels.js";

// SeedreamGenerateImageInput 生图请求参数
export type SeedreamGenerateImageInput = {
    prompt: string;
    modelId: SeedreamModelId;
    aspectRatio: SeedreamAspectRatioId;
    resolution: SeedreamResolution;
    referenceImages?: string[];
};

// SeedreamGeneratedImage 单张生成结果
export type SeedreamGeneratedImage = {
    url: string;
};

// SeedreamGenerateImageResult 生图响应（保持与前端契约一致）
export type SeedreamGenerateImageResult = {
    model: string;
    images: SeedreamGeneratedImage[];
    created: number;
};

// HuyaArtResultItem 虎牙轮询 results 数组项
type HuyaArtResultItem = {
    url?: string;
    type?: string;
    extension?: string | null;
};

// HuyaArtPollPayload 虎牙轮询成功响应结构
type HuyaArtPollPayload = {
    results?: HuyaArtResultItem[];
    created_at?: string;
    error?: unknown;
};

/**
 * Seedream 图片生成服务：封装虎牙 art 平台 Seedream API（提交 + 服务端内部轮询）
 */
export class SeedreamImageService {
    // 调用虎牙 art 平台生图：服务端内部轮询至 success 后一次性返回图片
    async generateImage(
        input: SeedreamGenerateImageInput,
        apiKeyOverride?: string,
    ): Promise<SeedreamGenerateImageResult> {
        const model = resolveSeedreamModel(input.modelId);
        const size = resolveSeedreamSize(input.resolution, input.aspectRatio);
        const type = resolveSeedreamType(input.referenceImages);

        const parameters: Record<string, unknown> = {
            prompt: input.prompt,
            size,
            sequential_image_generation: false,
            max_images: 1,
        };

        // image2image 参考图字段名为 image（array[image]，单数），text2image 不传
        if (type === "image2image" && input.referenceImages && input.referenceImages.length > 0) {
            parameters.image = input.referenceImages;
        }

        const submitBody = {
            model: {
                provider: resolveSeedreamProvider(),
                model,
                type,
            },
            parameters,
        };

        let payload: HuyaArtPollPayload;

        try {
            payload = (await huyaArtSubmitAndPoll(submitBody, apiKeyOverride, {
                maxWaitMs: 90_000,
                intervalMs: 3_000,
                label: "Seedream",
            })) as HuyaArtPollPayload;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(parseHuyaArtApiError(message, 0, "Seedream"));
        }

        const images =
            payload.results
                ?.map((item) => item.url)
                .filter((url): url is string => Boolean(url))
                .map((url) => ({ url })) ?? [];

        if (images.length === 0) {
            throw new Error("Seedream 未返回可用图片");
        }

        return {
            model,
            images,
            created: parseCreatedAtToEpoch(payload.created_at) ?? Math.floor(Date.now() / 1000),
        };
    }
}

// 将虎牙 ISO 时间字符串转为 epoch 秒
function parseCreatedAtToEpoch(created_at?: string): number | undefined {
    if (!created_at) {
        return undefined;
    }

    const ms = Date.parse(created_at);

    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

// seedreamImageService Seedream 图片生成服务单例
export const seedreamImageService = new SeedreamImageService();
