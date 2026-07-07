import { describe, expect, it } from "vitest";
import { getEpisodeEditPath } from "@/lib/episodeEditPaths";

describe("getEpisodeEditPath", () => {
    it("返回分集编辑基础路径", () => {
        expect(getEpisodeEditPath(12, 3)).toBe("/novel/project/12/episode/3/edit");
    });

    it("附带 fragment_id 查询参数", () => {
        expect(getEpisodeEditPath(12, 3, "5")).toBe(
            "/novel/project/12/episode/3/edit?fragment_id=5",
        );
    });

    it("短视频项目使用 /video 前缀", () => {
        expect(getEpisodeEditPath(12, 3, undefined, "video")).toBe(
            "/video/project/12/episode/3/edit",
        );
    });
});
