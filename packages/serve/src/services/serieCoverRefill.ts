// 分镜封面回填：为已生成视频但缺封面的历史分镜补提取首帧
import { prisma } from "../config/prisma.js";
import { resolveAssetMediaUrl } from "../lib/storageUrl.js";
import { extractFirstFrameToBuffer } from "../lib/videoProcess.js";
import { qiniuService } from "./qiniu.js";
import { serieService } from "./serie.js";
import { listSerieFragmentRows } from "./serieFragment.js";

// CoverRefillResult 单个分镜回填结果
type CoverRefillResult = {
    fragmentId: number;
    coverKey: string;
};

// CoverRefillSummary 回填汇总
export type CoverRefillSummary = {
    refilled: number[];
    failed: number[];
};

// 下载远程视频为 Buffer
async function downloadVideoBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`下载片段视频失败（HTTP ${response.status}）`);
    }

    return Buffer.from(await response.arrayBuffer());
}

/**
 * 为分集下缺封面的已生成分镜回填首帧
 * 仅处理 video 非空且 cover 为空的分镜；逐个下载→提取首帧→上传→写回
 */
export async function refillSerieFragmentCovers(
    userId: number,
    projectId: number,
    serieId: number,
): Promise<CoverRefillSummary> {
    // 断归属
    await serieService.getSerieDetail(userId, projectId, serieId);

    const rows = await listSerieFragmentRows(serieId);

    // targets 待回填分镜（video 非空、cover 空）
    const targets = rows.filter(
        (row) => (row.video ?? "").trim().length > 0 && (row.cover ?? "").trim().length === 0,
    );

    const refilled: number[] = [];
    const failed: number[] = [];

    for (const fragment of targets) {
        try {
            const videoUrl = resolveAssetMediaUrl(fragment.video);

            if (!videoUrl) {
                failed.push(fragment.id);
                continue;
            }

            const videoBuffer = await downloadVideoBuffer(videoUrl);
            const frameBuffer = await extractFirstFrameToBuffer(videoBuffer);
            const coverKey = (await qiniuService.uploadBuffer("image", frameBuffer, "jpg", "image/jpeg")).key;

            await prisma.serie_fragment.update({
                where: { id: fragment.id },
                data: { cover: coverKey },
            });

            refilled.push(fragment.id);
        } catch {
            failed.push(fragment.id);
        }
    }

    return { refilled, failed };
}
