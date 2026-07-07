import type { ProjectSerie, SerieParams } from "@/api/serie";
import type { ProjectKind } from "@/lib/projectSteps";

// CHINESE_NUMERALS 中文数字表（支持 1-99）
const CHINESE_NUMERALS = [
    "零",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
] as const;

// 根据 kind 返回序数单位：短剧「集」、短视频「条」
function resolveEpisodeUnit(kind: ProjectKind = "novel"): string {
    return kind === "video" ? "条" : "集";
}

// 将 1-99 转为中文序数名（如 第一集、第十二集 / 第一条、第十二条）
export function formatChineseEpisodeSubtitle(index: number, kind: ProjectKind = "novel"): string {
    const unit = resolveEpisodeUnit(kind);

    if (!Number.isFinite(index) || index <= 0) {
        return `第一${unit}`;
    }

    if (index <= 10) {
        return `第${CHINESE_NUMERALS[index]}${unit}`;
    }

    if (index < 20) {
        return `第十${CHINESE_NUMERALS[index - 10]}${unit}`;
    }

    const tens = Math.floor(index / 10);
    const ones = index % 10;

    if (ones === 0) {
        return `第${CHINESE_NUMERALS[tens]}十${unit}`;
    }

    return `第${CHINESE_NUMERALS[tens]}十${CHINESE_NUMERALS[ones]}${unit}`;
}

// 解析分集 params 为结构化对象
export function parseSerieParams(params: unknown): SerieParams {
    if (!params || typeof params !== "object") {
        return {};
    }

    return params as SerieParams;
}

// 根据已有分集列表构建下一集创建参数（短视频按「条」命名）
export function buildNextSerieCreateInput(
    series: Array<{ name: string }>,
    kind: ProjectKind = "novel",
) {
    // nextIndex 下一集序号（从 1 开始）
    const nextIndex = series.length + 1;
    const unit = resolveEpisodeUnit(kind);

    return {
        name: `第 ${nextIndex} ${unit}`,
        params: {
            subtitle: formatChineseEpisodeSubtitle(nextIndex, kind),
            stats: {
                characterCount: 0,
                sceneCount: 0,
                storyboardCount: 0,
            },
        },
    };
}

// 读取分集可编辑副标题（卡片「第1集：xxx」中的 xxx）
export function resolveSerieEditableSubtitle(serie: ProjectSerie): string {
    const params = parseSerieParams(serie.params);
    return params.subtitle?.trim() || serie.name.trim();
}

// 合并分集重命名结果到本地对象
export function buildSerieRenameUpdate(serie: ProjectSerie, nextSubtitle: string): ProjectSerie {
    const params = parseSerieParams(serie.params);

    return {
        ...serie,
        params: {
            ...params,
            subtitle: nextSubtitle.trim(),
        },
    };
}

// 格式化分集 / 短视频卡片标题
// 短剧：第1集：第一集；短视频：第1条（不带 subtitle 后缀）
export function formatSerieEpisodeCardTitle(
    serie: ProjectSerie,
    episodeIndex: number,
    kind: ProjectKind = "novel",
): string {
    const unit = resolveEpisodeUnit(kind);
    const prefix = `第${episodeIndex}${unit}`;

    // 短视频只展示序数前缀，不再拼接冗余 subtitle
    if (kind === "video") {
        return prefix;
    }

    const params = parseSerieParams(serie.params);
    const subtitle = params.subtitle?.trim() || serie.name.trim();

    return `${prefix}：${subtitle}`;
}

// 格式化分集统计文案
export function formatSerieEpisodeStats(serie: ProjectSerie): string {
    const stats = parseSerieParams(serie.params).stats ?? {};

    // characterCount 角色数量
    const characterCount = stats.characterCount ?? 0;
    // sceneCount 场景数量
    const sceneCount = stats.sceneCount ?? 0;
    // storyboardCount 分镜数量
    const storyboardCount = stats.storyboardCount ?? 0;

    return `角色 ${characterCount} · 场景 ${sceneCount} · 分镜 ${storyboardCount}`;
}

// 统计分集 fragments 数组长度（非数组视为 0）
export function countSerieFragments(fragments: unknown): number {
    if (!Array.isArray(fragments)) {
        return 0;
    }

    return fragments.length;
}

// 解析分集状态展示文案（fragments 为空则待生成）
export function resolveSerieStatusLabel(fragments: unknown, params?: unknown): string {
    const status = parseSerieParams(params).status;

    if (status === "generating") {
        return "生成中";
    }

    if (countSerieFragments(fragments) === 0) {
        return "待生成";
    }

    return "已生成";
}
