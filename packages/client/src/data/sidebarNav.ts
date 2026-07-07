import type { LucideIcon } from "lucide-react";
import { Clapperboard, Cloud } from "lucide-react";

// 侧边栏导航项类型
export type SidebarNavItem = {
    id: string;
    label: string;
    path: string;
    icon: LucideIcon;
};

/*
 * SIDEBAR_NAV_ITEMS 应用壳侧边栏导航配置
 */
export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
    {
        id: "novel",
        label: "短剧 Agent",
        path: "/novel",
        icon: Clapperboard,
    },
    {
        id: "asset",
        label: "资产",
        path: "/asset",
        icon: Cloud,
    },
];
