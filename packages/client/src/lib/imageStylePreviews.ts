import type { ImageStyleId } from "@/lib/imageStyles";

// IMAGE_STYLE_PREVIEW_BASE 风格预览图静态资源路径前缀
// 拼接 Vite base 前缀，确保 base 改为子路径（如 /huyueyinghua/）时预览图仍能正确加载
// import.meta.env.BASE_URL 末尾自带斜杠，故这里不再以 / 开头
const IMAGE_STYLE_PREVIEW_BASE = `${import.meta.env.BASE_URL}image-styles`;

// 返回风格预览图 URL（对应 public/image-styles/{id}.jpg）
export function getImageStylePreviewUrl(styleId: ImageStyleId): string {
    return `${IMAGE_STYLE_PREVIEW_BASE}/${styleId}.jpg`;
}
