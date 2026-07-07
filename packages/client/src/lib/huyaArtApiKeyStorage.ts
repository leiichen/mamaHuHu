// HUYA_ART_API_KEY_STORAGE_KEY localStorage 存储键（版本化）
const HUYA_ART_API_KEY_STORAGE_KEY = "huyaArtApiKey:v1";

// LEGACY_ARK_API_KEY_STORAGE_KEY 旧版火山方舟 Key 存储键（迁移期回退读取，平滑过渡）
const LEGACY_ARK_API_KEY_STORAGE_KEY = "arkApiKey:v1";

// HUYA_ART_API_KEY_HEADER 随 API 请求发送的虎牙 art Key 请求头
export const HUYA_ART_API_KEY_HEADER = "X-Huya-Art-Key";

// huyaArtApiKeyCache 内存缓存，避免每次请求重复读取 localStorage
let huyaArtApiKeyCache: string | null | undefined;

// 从 localStorage 读取用户配置的虎牙 art API Key（新 key 为空时回退读旧版 ark key）
export function loadHuyaArtApiKey(): string {
    if (huyaArtApiKeyCache !== undefined) {
        return huyaArtApiKeyCache ?? "";
    }

    try {
        const stored = localStorage.getItem(HUYA_ART_API_KEY_STORAGE_KEY)?.trim() ?? "";
        // 旧版火山方舟 Key 平滑迁移：新 key 未配置时回退读旧 key
        const value = stored || localStorage.getItem(LEGACY_ARK_API_KEY_STORAGE_KEY)?.trim() || "";
        huyaArtApiKeyCache = value || null;

        return value;
    } catch {
        huyaArtApiKeyCache = null;

        return "";
    }
}

// HUYA_ART_API_KEY_CHANGED_EVENT 本地 Key 变更时派发的全局事件名
export const HUYA_ART_API_KEY_CHANGED_EVENT = "xyq:huya-art-api-key-changed";

// 派发虎牙 art API Key 变更事件，供全局 Notice 等订阅
function dispatchHuyaArtApiKeyChanged() {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(HUYA_ART_API_KEY_CHANGED_EVENT));
}

// 保存用户配置的虎牙 art API Key（空字符串表示清除）
export function saveHuyaArtApiKey(value: string): void {
    const trimmed = value.trim();

    try {
        if (trimmed) {
            localStorage.setItem(HUYA_ART_API_KEY_STORAGE_KEY, trimmed);
        } else {
            localStorage.removeItem(HUYA_ART_API_KEY_STORAGE_KEY);
        }
    } catch {
        // 隐私模式或配额不足时忽略
    }

    huyaArtApiKeyCache = trimmed || null;
    dispatchHuyaArtApiKeyChanged();
}

// 清除用户配置的虎牙 art API Key
export function clearHuyaArtApiKey(): void {
    saveHuyaArtApiKey("");
}

// 判断用户是否已配置自定义虎牙 art API Key
export function hasCustomHuyaArtApiKey(): boolean {
    return loadHuyaArtApiKey().length > 0;
}
