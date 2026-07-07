import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { ASSET_LIST_FILTER_TYPES } from "../lib/assetCategory.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { resolveAssetMediaUrl } from "../lib/storageUrl.js";
import type { ProjectKind } from "./script.js";

// DEFAULT_PROJECT_TITLE 新建项目时的固定默认标题
const DEFAULT_PROJECT_TITLE = "未命名项目";

// DEFAULT_RECENT_LIMIT 最近项目列表默认条数
const DEFAULT_RECENT_LIMIT = 12;

// 从 project.params 解析项目类型，缺省为 novel（向后兼容历史数据）
function parseProjectKind(params: unknown): ProjectKind {
    if (params && typeof params === "object" && !Array.isArray(params)) {
        const kind = (params as { kind?: unknown }).kind;

        if (kind === "novel" || kind === "video") {
            return kind;
        }
    }

    return "novel";
}

// 格式化返回给前端的项目信息
function formatProject(project: {
    id: number;
    title: string;
    description: string | null;
    content: unknown;
    params: unknown;
    created_at: Date;
    updated_at: Date;
}) {
    return {
        id: project.id,
        title: project.title,
        description: project.description,
        content: project.content,
        params: project.params,
        kind: parseProjectKind(project.params),
        createdAt: project.created_at,
        updatedAt: project.updated_at,
    };
}

// 格式化最近项目列表项（含剧集数量与封面）
function formatRecentProject(project: {
    id: number;
    title: string;
    description: string | null;
    content: unknown;
    params: unknown;
    created_at: Date;
    updated_at: Date;
    _count: {
        series: number;
    };
    // 封面取该项目首个有 url 的角色资产（listRecentByUser 嵌套 include 取 take:1）
    assets?: Array<{ url: string | null }>;
}) {
    return {
        ...formatProject(project),
        episodeCount: project._count.series,
        cover: resolveAssetMediaUrl(project.assets?.[0]?.url ?? null),
    };
}

export class ProjectService {
    // 为当前用户静默新建项目（固定默认标题，无需前端传参）
    async createProject(userId: number) {
        const project = await prisma.project.create({
            data: {
                title: DEFAULT_PROJECT_TITLE,
                user_id: userId,
            },
        });

        return formatProject(project);
    }

    // 查询当前用户最近更新的项目列表（可按项目类型 kind 过滤）
    // kind="video" 仅返回短视频项目；kind="novel" 返回短剧项目（含 params 为 null 的历史数据，向后兼容）；
    // 不传 kind 返回全部。
    async listRecentByUser(userId: number, limit = DEFAULT_RECENT_LIMIT, kind?: ProjectKind) {
        // kindFilter 项目类型过滤条件；novel 额外包含 params 为 null 的历史项目
        const kindFilter =
            kind === undefined
                ? undefined
                : kind === "novel"
                  ? {
                        // 短剧 = kind=novel，或 params 为 SQL NULL 的历史项目（kind 字段引入前创建）
                        OR: [
                            { params: { path: "$.kind", equals: "novel" } },
                            { params: { equals: Prisma.DbNull } },
                        ],
                    }
                  : { params: { path: "$.kind", equals: "video" } };

        const projects = await prisma.project.findMany({
            where: {
                user_id: userId,
                ...(kindFilter ? kindFilter : {}),
            },
            orderBy: { updated_at: "desc" },
            take: limit,
            include: {
                _count: {
                    select: { series: true },
                },
                // 取每个项目首个有 url 的角色资产作封面（take:1 避免全量加载）
                assets: {
                    where: {
                        type: "character",
                        url: { not: null },
                    },
                    select: { url: true },
                    orderBy: { created_at: "asc" },
                    take: 1,
                },
            },
        });

        return projects.map(formatRecentProject);
    }

    // 统计项目各资产 Tab 数量（不含 type=none 的画布节点）
    async countAssetTabsByProject(projectId: number) {
        const rows = await prisma.asset.groupBy({
            by: ["type"],
            where: {
                project_id: projectId,
                type: { in: [...ASSET_LIST_FILTER_TYPES] },
            },
            _count: { id: true },
        });

        /*
         * counts 各 Tab 默认数量
         * row 分组统计行
         */
        const counts = Object.fromEntries(
            ASSET_LIST_FILTER_TYPES.map((type) => [type, 0]),
        ) as Record<(typeof ASSET_LIST_FILTER_TYPES)[number], number>;

        for (const row of rows) {
            if (row.type in counts) {
                counts[row.type as keyof typeof counts] = row._count.id;
            }
        }

        return counts;
    }

    // 查询项目详情，并返回是否存在剧情（script）记录及各资产 Tab 数量
    async getProjectDetail(userId: number, projectId: number) {
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                user_id: userId,
            },
            include: {
                script: {
                    select: { id: true },
                },
            },
        });

        if (!project) {
            throw new NotFoundError("项目不存在");
        }

        const assetTabCounts = await this.countAssetTabsByProject(projectId);

        return {
            ...formatProject(project),
            hasScript: project.script !== null,
            assetTabCounts,
        };
    }

    // 重命名项目
    async updateProjectTitle(userId: number, projectId: number, title: string) {
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                user_id: userId,
            },
        });

        if (!project) {
            throw new NotFoundError("项目不存在");
        }

        const updated = await prisma.project.update({
            where: { id: projectId },
            data: { title },
        });

        return formatProject(updated);
    }

    // 批量删除项目（单条删除同样走此接口）
    async deleteProjects(userId: number, projectIds: number[]) {
        const uniqueProjectIds = [...new Set(projectIds)];

        if (uniqueProjectIds.length === 0) {
            throw new BadRequestError("至少选择一个项目");
        }

        const projects = await prisma.project.findMany({
            where: {
                id: { in: uniqueProjectIds },
                user_id: userId,
            },
        });

        if (projects.length !== uniqueProjectIds.length) {
            throw new NotFoundError("项目不存在");
        }

        await prisma.project.deleteMany({
            where: {
                id: { in: uniqueProjectIds },
                user_id: userId,
            },
        });

        return projects.map(formatProject);
    }
}

// projectService 项目服务单例（无状态，跨控制器复用）
export const projectService = new ProjectService();
