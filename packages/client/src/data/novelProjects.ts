// 短剧 Agent 项目卡片类型
export type NovelProject = {
    id: string;
    title: string;
    updatedAt: string;
    episodeCount: number;
    isExample?: boolean;
    cover?: string | null;
};

/*
 * NOVEL_MY_PROJECTS 我的项目示例数据
 */
export const NOVEL_MY_PROJECTS: NovelProject[] = [];
