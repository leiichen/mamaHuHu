import { env } from "../config/env.js";

// SeedreamModelId 前端生图模型 ID（虎牙 art 平台仅上架 4.5）
export type SeedreamModelId = "seedream-4.5";

// SeedreamAspectRatioId 输出比例 ID（auto 由模型推断宽高比）
export type SeedreamAspectRatioId =
    | "auto"
    | "16:9"
    | "21:9"
    | "9:16"
    | "4:3"
    | "3:4"
    | "1:1";

// SeedreamResolution 输出清晰度（虎牙无 3K 档，仅 2K/4K）
export type SeedreamResolution = "2K" | "4K";

// SEEDREAM_MODEL_IDS 支持的模型 ID 列表
export const SEEDREAM_MODEL_IDS = ["seedream-4.5"] as const;

// SEEDREAM_ASPECT_RATIO_IDS 支持的比例 ID 列表
export const SEEDREAM_ASPECT_RATIO_IDS = [
    "auto",
    "16:9",
    "21:9",
    "9:16",
    "4:3",
    "3:4",
    "1:1",
] as const;

// SEEDREAM_RESOLUTIONS 支持的清晰度列表
export const SEEDREAM_RESOLUTIONS = ["2K", "4K"] as const;

// SEEDREAM_MODEL_MAP 前端模型 ID 到虎牙 art 平台 model 标识的映射
const SEEDREAM_MODEL_MAP: Record<SeedreamModelId, string> = {
    "seedream-4.5": env.SEEDREAM_MODEL,
};

/*
 * SEEDREAM_SIZE_MAP 清晰度 + 比例到虎牙 art 平台 size 参数的映射
 * 值取自虎牙 /model/info 对 doubao-seedream-4-5-251128 探测的合法 options（text2image 与 image2image 一致）
 * auto 时使用清晰度关键词（2K/4K），由模型根据 prompt 推断宽高比
 */
const SEEDREAM_SIZE_MAP: Record<SeedreamResolution, Record<SeedreamAspectRatioId, string>> = {
    "2K": {
        auto: "2K",
        "1:1": "2048x2048",
        "16:9": "2560x1440",
        "21:9": "3024x1296",
        "9:16": "1440x2560",
        "4:3": "2304x1728",
        "3:4": "1728x2304",
    },
    "4K": {
        auto: "4K",
        "1:1": "4096x4096",
        "16:9": "5504x3040",
        "21:9": "6240x2656",
        "9:16": "3040x5504",
        "4:3": "4704x3520",
        "3:4": "3520x4704",
    },
};

// 根据前端模型 ID 解析虎牙 art 平台 model 标识
export function resolveSeedreamModel(modelId: SeedreamModelId): string {
    const model = SEEDREAM_MODEL_MAP[modelId];

    if (!model) {
        throw new Error(`未配置模型 ${modelId} 对应的 Seedream model`);
    }

    return model;
}

// 根据清晰度与比例解析虎牙 art 平台 size 参数
export function resolveSeedreamSize(
    resolution: SeedreamResolution,
    aspectRatio: SeedreamAspectRatioId,
): string {
    return SEEDREAM_SIZE_MAP[resolution][aspectRatio];
}

// 根据是否有参考图派生虎牙 art 平台 type（图生图 / 文生图）
export function resolveSeedreamType(referenceImages?: string[]): "image2image" | "text2image" {
    return referenceImages && referenceImages.length > 0 ? "image2image" : "text2image";
}

// 解析虎牙 art 平台 model 对象的 provider 字段
export function resolveSeedreamProvider(): string {
    return env.HUYA_ART_PROVIDER;
}
