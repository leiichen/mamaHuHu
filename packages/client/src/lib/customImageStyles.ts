// 自定义图片风格：localStorage 持久化 + 内存 blob 预览 URL（阶段一纯前端方案）
import { useEffect, useState } from "react";

// CUSTOM_STYLE_STORAGE_KEY localStorage 存储键
const CUSTOM_STYLE_STORAGE_KEY = "huyueyinghua:custom-image-styles";

// CUSTOM_STYLE_EVENT 自定义风格变更通知事件（同标签页内同步）
const CUSTOM_STYLE_EVENT = "huyueyinghua:custom-image-styles-changed";

// CustomImageStyle 自定义风格记录
export type CustomImageStyle = {
    id: string;
    label: string;
    prompt: string;
    // previewKey 七牛存储 key（阶段二后端据此签 URL）；阶段一前端不直接显示
    previewKey: string | null;
};

// blobUrlByStyleId 内存中保存上传时的临时 blob URL（刷新后丢失，预览回落占位）
const blobUrlByStyleId = new Map<string, string>();

// 安全解析 localStorage 中的自定义风格列表
function readStorage(): CustomImageStyle[] {
    try {
        const raw = localStorage.getItem(CUSTOM_STYLE_STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (item): item is CustomImageStyle =>
                item &&
                typeof item.id === "string" &&
                typeof item.label === "string" &&
                typeof item.prompt === "string" &&
                (item.previewKey === null || typeof item.previewKey === "string"),
        );
    } catch {
        return [];
    }
}

// 写入 localStorage 并通知订阅者
function writeStorage(styles: CustomImageStyle[]) {
    try {
        localStorage.setItem(CUSTOM_STYLE_STORAGE_KEY, JSON.stringify(styles));
    } catch {
        // 存储失败（如配额满）静默忽略，不影响当次使用
    }

    window.dispatchEvent(new CustomEvent(CUSTOM_STYLE_EVENT));
}

// 读取当前所有自定义风格
export function loadCustomImageStyles(): CustomImageStyle[] {
    return readStorage();
}

// 内置风格 ID 集合（与 imageStyles.ts IMAGE_STYLE_IDS 保持同步）
// 直接硬编码以避免与 imageStyles.ts 的循环依赖（customImageStyles ↔ imageStyles）
const BUILTIN_STYLE_IDS = [
    "retro-sci-fi-atompunk",
    "palace-intrigue-cold",
    "domestic-suspense-cold",
    "ancient-romance-soft",
    "japanese-youth-film",
    "japanese-daily-natural",
    "korean-urban-soft",
    "chinese-urban-realistic",
    "wuxia-realistic-photo",
    "90s-realistic-film",
    "retro-narrative-film",
    "american-retro-hollywood",
    "neon-cyberpunk-film",
    "90s-rural-china-film",
    "tezuka-era-cartoon",
    "shanghai-animation",
    "pixel-art",
    "shadow-puppet-illustration",
] as const;

const BUILTIN_STYLE_ID_SET = new Set<string>(BUILTIN_STYLE_IDS);

// 由风格名称生成唯一 ID：custom- + 名称转 kebab；冲突则追加数字后缀
export function generateCustomStyleId(label: string): string {
    const base = `custom-${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`;

    const existing = new Set<string>([...BUILTIN_STYLE_ID_SET, ...readStorage().map((s) => s.id)]);

    if (!existing.has(base)) {
        return base;
    }

    let suffix = 2;

    while (existing.has(`${base}-${suffix}`)) {
        suffix += 1;
    }

    return `${base}-${suffix}`;
}

// 新增一个自定义风格，同时记录其临时 blob 预览 URL
export function saveCustomImageStyle(style: CustomImageStyle, blobUrl?: string) {
    const styles = readStorage();
    styles.push(style);
    writeStorage(styles);

    if (blobUrl) {
        blobUrlByStyleId.set(style.id, blobUrl);
    }
}

// 读取某自定义风格的临时 blob 预览 URL（刷新后返回 undefined）
export function getCustomStyleBlobUrl(id: string): string | undefined {
    return blobUrlByStyleId.get(id);
}

// 订阅自定义风格变更（同标签页 CustomEvent + 跨标签 storage 事件）
export function subscribeCustomImageStyles(callback: () => void): () => void {
    const onCustom = () => callback();
    const onStorage = (event: StorageEvent) => {
        if (event.key === CUSTOM_STYLE_STORAGE_KEY) {
            callback();
        }
    };

    window.addEventListener(CUSTOM_STYLE_EVENT, onCustom);
    window.addEventListener("storage", onStorage);

    return () => {
        window.removeEventListener(CUSTOM_STYLE_EVENT, onCustom);
        window.removeEventListener("storage", onStorage);
    };
}

// useCustomImageStyles 订阅自定义风格变化的 hook
export function useCustomImageStyles(): CustomImageStyle[] {
    const [styles, setStyles] = useState<CustomImageStyle[]>(() => loadCustomImageStyles());

    useEffect(() => {
        const unsubscribe = subscribeCustomImageStyles(() => {
            setStyles(loadCustomImageStyles());
        });

        return unsubscribe;
    }, []);

    return styles;
}
