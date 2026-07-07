import { env } from "../config/env.js";

// SeedanceModelId 前端视频模型 ID（虎牙 art 平台仅上架 Seedance 2.0 Pro）
export type SeedanceModelId = "seedance-2";

// SeedanceRatioId 视频比例
export type SeedanceRatioId = "16:9" | "21:9" | "9:16" | "4:3";

// SeedanceResolution 视频分辨率
export type SeedanceResolution = "480p" | "720p";

// SEEDANCE_MODEL_MAP 前端模型 ID 到虎牙 art 平台 model 标识的映射
const SEEDANCE_MODEL_MAP: Record<SeedanceModelId, string> = {
    "seedance-2": env.SEEDANCE_MODEL,
};

// 根据前端模型 ID 解析虎牙 art 平台 model 标识
export function resolveSeedanceModel(modelId: string | undefined): string {
    const normalized: SeedanceModelId = "seedance-2";
    const model = SEEDANCE_MODEL_MAP[normalized];

    if (!model) {
        throw new Error(`未配置模型 ${normalized} 对应的 Seedance model`);
    }

    return model;
}

// 解析 Seedance aspectRatio 参数（虎牙支持 16:9/4:3/1:1/3:4/9:16/21:9/adaptive）
export function resolveSeedanceRatio(aspectRatio: string | undefined): SeedanceRatioId {
    const allowed: SeedanceRatioId[] = ["16:9", "21:9", "9:16", "4:3"];

    if (aspectRatio && allowed.includes(aspectRatio as SeedanceRatioId)) {
        return aspectRatio as SeedanceRatioId;
    }

    return "9:16";
}

// 解析 Seedance resolution 参数（虎牙支持 480p/720p/1080p）
export function resolveSeedanceResolution(resolution: string | undefined): SeedanceResolution {
    if (resolution === "720p" || resolution === "480p") {
        return resolution;
    }

    return "480p";
}

// 根据是否有参考素材派生虎牙 art 平台 type（图生视频 / 文生视频）
export function resolveSeedanceType(referenceLength: number): "image2video" | "text2video" {
    return referenceLength > 0 ? "image2video" : "text2video";
}

// 解析虎牙 art 平台 model 对象的 provider 字段
export function resolveSeedanceProvider(): string {
    return env.HUYA_ART_PROVIDER;
}
