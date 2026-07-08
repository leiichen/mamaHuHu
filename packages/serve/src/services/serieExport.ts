// 分集视频导出：把一个分集下所有片段按时序拼接为一条完整 mp4
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { BadRequestError } from "../lib/errors.js";
import { resolveAssetMediaUrl } from "../lib/storageUrl.js";
import {
    concatenateFragmentsToBuffer,
    parseExportResolution,
    probeFileHasAudio,
    type ConcatFragmentInput,
} from "../lib/videoProcess.js";
import { qiniuService } from "./qiniu.js";
import { serieService } from "./serie.js";

// ExportJobStatus 导出任务状态
export type ExportJobStatus = "queued" | "running" | "succeeded" | "failed";

// ExportJobResult 导出成功产物
export type ExportJobResult = {
    videoKey: string;
    videoUrl: string;
    createdAt: number;
};

// ExportJobState 内存任务状态
type ExportJobState = {
    jobId: string;
    userId: number;
    projectId: number;
    serieId: number;
    status: ExportJobStatus;
    progress?: number;
    message?: string;
    result?: ExportJobResult;
    createdAt: number;
    updatedAt: number;
};

// ExportJobPollResult 轮询返回
export type ExportJobPollResult = {
    status: ExportJobStatus;
    progress?: number;
    message?: string;
    result?: ExportJobResult;
};

// exportJobStore 内存任务存储（重启丢失，开发期可接受）
const exportJobStore = new Map<string, ExportJobState>();

// JOB_TTL_MS 任务保留时长（30 分钟）
const JOB_TTL_MS = 30 * 60 * 1000;

// 定期清理过期终态任务
setInterval(() => {
    const now = Date.now();

    for (const [jobId, job] of exportJobStore) {
        if (
            (job.status === "succeeded" || job.status === "failed") &&
            now - job.updatedAt > JOB_TTL_MS
        ) {
            exportJobStore.delete(jobId);
        }
    }
}, 5 * 60 * 1000).unref();

// 更新任务状态
function updateJob(jobId: string, patch: Partial<ExportJobState>) {
    const job = exportJobStore.get(jobId);

    if (!job) {
        return;
    }

    job.updatedAt = Date.now();
    Object.assign(job, patch);
}

// 下载远程视频为 Buffer
async function downloadVideoBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`下载片段视频失败（HTTP ${response.status}）`);
    }

    return Buffer.from(await response.arrayBuffer());
}

// 执行导出：下载各片段 → 拼接 → 上传 → 持久化
async function runExportJob(
    jobId: string,
    userId: number,
    projectId: number,
    serieId: number,
    fragmentVideoUrls: string[],
    resolution: { resolution?: string; aspectRatio?: string },
) {
    try {
        updateJob(jobId, { status: "running", progress: 0.1 });

        const target = parseExportResolution(resolution.resolution, resolution.aspectRatio);
        const dir = await mkdtemp(join(tmpdir(), "xyq-export-probe-"));
        const inputs: ConcatFragmentInput[] = [];

        try {
            for (let index = 0; index < fragmentVideoUrls.length; index += 1) {
                const url = fragmentVideoUrls[index];
                const buffer = await downloadVideoBuffer(url);

                // 落盘探测音频流，无音频则拼接时补静音
                const probePath = join(dir, `probe-${index}.mp4`);
                await writeFile(probePath, buffer);
                const hasAudio = await probeFileHasAudio(probePath);

                inputs.push({ buffer, hasAudio });
                updateJob(jobId, {
                    progress: 0.1 + (0.3 * (index + 1)) / fragmentVideoUrls.length,
                });
            }
        } finally {
            await rm(dir, { recursive: true, force: true }).catch(() => {});
        }

        updateJob(jobId, { progress: 0.4 });

        const mergedBuffer = await concatenateFragmentsToBuffer(inputs, target);

        updateJob(jobId, { progress: 0.85 });

        const uploaded = await qiniuService.uploadBuffer(
            "video",
            mergedBuffer,
            "mp4",
            "video/mp4",
        );

        updateJob(jobId, { progress: 0.95 });

        const createdAt = Date.now();
        await serieService.persistExportedVideo(userId, projectId, serieId, {
            key: uploaded.key,
            createdAt,
        });

        const videoUrl = resolveAssetMediaUrl(uploaded.key) ?? uploaded.key;

        updateJob(jobId, {
            status: "succeeded",
            progress: 1,
            result: { videoKey: uploaded.key, videoUrl, createdAt },
        });
    } catch (error) {
        updateJob(jobId, {
            status: "failed",
            message: error instanceof Error ? error.message : "导出失败",
        });
    }
}

// 读取分集视频生成参数（resolution/aspectRatio）
function readSerieVideoGenerationParams(
    params: unknown,
): { resolution?: string; aspectRatio?: string } {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        return {};
    }

    const record = (params as Record<string, unknown>).videoGeneration;

    if (!record || typeof record !== "object" || Array.isArray(record)) {
        return {};
    }

    const vg = record as Record<string, unknown>;

    return {
        resolution: typeof vg.resolution === "string" ? vg.resolution : undefined,
        aspectRatio: typeof vg.aspectRatio === "string" ? vg.aspectRatio : undefined,
    };
}

/**
 * 提交分集导出任务
 * @returns { jobId }
 */
export async function submitSerieExport(
    userId: number,
    projectId: number,
    serieId: number,
): Promise<{ jobId: string }> {
    const detail = await serieService.getSerieDetail(userId, projectId, serieId);

    // fragments 已序列化：video 为签名 URL 或空串，按 sort_order 有序
    const fragments = Array.isArray(detail.fragments) ? detail.fragments : [];
    const videoUrls = fragments
        .map((fragment) => {
            if (!fragment || typeof fragment !== "object") {
                return "";
            }

            const video = (fragment as Record<string, unknown>).video;
            return typeof video === "string" ? video.trim() : "";
        })
        .filter((url) => url.length > 0);

    if (videoUrls.length === 0) {
        throw new BadRequestError("没有可导出的片段视频");
    }

    // 读取分集原始 params（含 videoGeneration），用于推导导出分辨率
    const serieRow = await prisma.serie.findUnique({
        where: { id: serieId },
        select: { params: true },
    });
    const resolution = readSerieVideoGenerationParams(serieRow?.params);

    const jobId = randomUUID();
    const now = Date.now();

    exportJobStore.set(jobId, {
        jobId,
        userId,
        projectId,
        serieId,
        status: "queued",
        createdAt: now,
        updatedAt: now,
    });

    // 异步执行，不阻塞响应
    void runExportJob(jobId, userId, projectId, serieId, videoUrls, resolution);

    return { jobId };
}

/**
 * 轮询导出任务状态
 */
export function pollSerieExport(
    userId: number,
    projectId: number,
    serieId: number,
    jobId: string,
): ExportJobPollResult {
    const job = exportJobStore.get(jobId);

    if (!job) {
        return { status: "failed", message: "导出任务不存在或已过期" };
    }

    // 校验任务归属
    if (job.userId !== userId || job.projectId !== projectId || job.serieId !== serieId) {
        return { status: "failed", message: "导出任务不存在或已过期" };
    }

    return {
        status: job.status,
        progress: job.progress,
        message: job.message,
        result: job.result,
    };
}
