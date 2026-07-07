import type { Request } from "express";
import { env } from "../config/env.js";

// HUYA_ART_API_KEY_HEADER 客户端可覆盖虎牙 art API Key 的请求头
export const HUYA_ART_API_KEY_HEADER = "x-huya-art-key";

// 从请求头读取客户端传入的虎牙 art API Key
export function readHuyaArtApiKeyHeader(value: string | string[] | undefined): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    const trimmed = raw?.trim();

    return trimmed || undefined;
}

// 从 Express 请求中读取客户端传入的虎牙 art API Key
export function readHuyaArtApiKeyFromRequest(req: Pick<Request, "headers">): string | undefined {
    return readHuyaArtApiKeyHeader(req.headers[HUYA_ART_API_KEY_HEADER]);
}

/**
 * 解析用于虎牙 art 调用的 API Key：优先使用客户端请求头，其次使用服务端环境变量
 * @param override 客户端传入的 Key（通常来自 X-Huya-Art-Key）
 */
export function resolveHuyaArtApiKey(override?: string): string {
    const key = override?.trim() || env.HUYA_ART_API_KEY?.trim();

    if (!key) {
        throw new Error("未配置 HUYA_ART_API_KEY");
    }

    return key;
}

// 判断服务端环境变量是否已配置虎牙 art API Key
export function isServerHuyaArtApiKeyConfigured(): boolean {
    return Boolean(env.HUYA_ART_API_KEY?.trim());
}
