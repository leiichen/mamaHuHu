import { request } from "@/api/http";

// HuyaArtApiKeyStatus 服务端虎牙 art API Key 配置状态
export type HuyaArtApiKeyStatus = {
    configured: boolean;
};

// OpenaiApiKeyStatus 服务端 OpenAI API Key 配置状态
export type OpenaiApiKeyStatus = {
    configured: boolean;
};

// 查询服务端是否已配置虎牙 art API Key
export function fetchHuyaArtApiKeyStatus(signal?: AbortSignal) {
    return request<HuyaArtApiKeyStatus>("/config/art_key", {
        method: "GET",
        signal,
    });
}

// 查询服务端是否已配置 OpenAI API Key
export function fetchOpenaiApiKeyStatus(signal?: AbortSignal) {
    return request<OpenaiApiKeyStatus>("/config/openai_key", {
        method: "GET",
        signal,
    });
}
