import { huyaArtFetch, parseHuyaArtApiError } from "../lib/huyaArtClient.js";
import type { SeedanceGenerateBody } from "../lib/buildSeedanceGenerateBody.js";

// SeedanceTaskStatus Seedance 任务状态（与 serieGeneration 依赖的统一状态）
export type SeedanceTaskStatus = "queued" | "running" | "succeeded" | "failed";

// SeedanceTaskResult 查询任务结果
export type SeedanceTaskResult = {
    taskId: string;
    status: SeedanceTaskStatus;
    progress?: number;
    videoUrl?: string;
    lastFrameUrl?: string;
    durationSec?: number;
    errorMessage?: string;
};

// HuyaArtSubmitPayload 虎牙提交任务返回
type HuyaArtSubmitPayload = {
    task_id?: string | number;
    id?: string | number;
    status?: string;
    message?: string;
    error?: unknown;
};

// HuyaArtResultItem 虎牙轮询 results 数组项（视频或图片）
type HuyaArtResultItem = {
    url?: string;
    type?: string;
    extension?: string | null;
};

// HuyaArtTaskPayload 虎牙轮询任务返回（视频结构按图片实测类推，联调时回填）
type HuyaArtTaskPayload = {
    id?: string | number;
    status?: string;
    progress?: number | null;
    results?: HuyaArtResultItem[];
    parameters?: { duration?: number };
    error?: unknown;
};

// 将虎牙原始状态映射为统一状态（虎牙成功为 "success"）
function normalizeTaskStatus(rawStatus: string | undefined): SeedanceTaskStatus {
    switch (rawStatus) {
        case "success":
        case "succeeded":
        case "completed":
            return "succeeded";
        case "failed":
        case "error":
        case "expired":
        case "cancelled":
            return "failed";
        case "queued":
            return "queued";
        case "running":
        case "in_progress":
        case "processing":
        case "submitted":
            return "running";
        default:
            return "running";
    }
}

/**
 * Seedance 视频生成服务：封装虎牙 art 平台 Seedance API
 */
export class SeedanceVideoService {
    // 创建视频生成任务（虎牙图片/视频均提交至 /generate/image）
    async createTask(
        body: SeedanceGenerateBody,
        apiKeyOverride?: string,
    ): Promise<{ taskId: string }> {
        const response = await huyaArtFetch(
            "/generate/image",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            },
            apiKeyOverride,
        );

        const payload = (await response.json().catch(() => null)) as HuyaArtSubmitPayload | null;

        if (!response.ok) {
            throw new Error(parseHuyaArtApiError(payload, response.status, "Seedance"));
        }

        const rawTaskId = payload?.task_id ?? payload?.id;
        const taskId = rawTaskId === undefined || rawTaskId === null ? "" : String(rawTaskId).trim();

        if (!taskId) {
            throw new Error("Seedance 未返回任务 ID");
        }

        return { taskId };
    }

    // 查询视频生成任务状态
    async getTask(taskId: string, apiKeyOverride?: string): Promise<SeedanceTaskResult> {
        const response = await huyaArtFetch(
            `/generate/result/${taskId}`,
            { method: "GET" },
            apiKeyOverride,
        );

        const payload = (await response.json().catch(() => null)) as HuyaArtTaskPayload | null;

        if (!response.ok) {
            throw new Error(parseHuyaArtApiError(payload, response.status, "Seedance"));
        }

        const status = normalizeTaskStatus(payload?.status);

        // 视频地址：优先取 type==="video" 的 url，否则回退首个有 url 的项
        const results = payload?.results ?? [];
        const videoItem =
            results.find((item) => item.type === "video" && item.url) ??
            results.find((item) => typeof item.url === "string" && item.url);
        const videoUrl = typeof videoItem?.url === "string" ? videoItem.url : undefined;

        // 虎牙 Seedance 不输出尾帧（无 return_last_frame 等价），尾帧恒为空
        const durationSec =
            typeof payload?.parameters?.duration === "number" &&
            Number.isFinite(payload.parameters.duration) &&
            payload.parameters.duration > 0
                ? Math.trunc(payload.parameters.duration)
                : undefined;

        return {
            taskId,
            status,
            progress: typeof payload?.progress === "number" ? payload.progress : undefined,
            videoUrl,
            lastFrameUrl: undefined,
            durationSec,
            errorMessage:
                status === "failed"
                    ? parseHuyaArtApiError(payload, response.status, "Seedance")
                    : undefined,
        };
    }
}

// seedanceVideoService Seedance 视频生成服务单例
export const seedanceVideoService = new SeedanceVideoService();
