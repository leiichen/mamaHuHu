import { env } from "../config/env.js";
import { resolveHuyaArtApiKey } from "./huyaArtApiKey.js";

// HuyaArtErrorPayload 虎牙 art 错误响应结构（error 可能是字符串、对象，或顶层 message）
type HuyaArtErrorPayload = {
    error?: string | { message?: string; code?: string; message_code?: string };
    message?: string;
    error_code?: string;
};

/**
 * 解析虎牙 art API 错误信息：兼容 error 为字符串/对象、顶层 message，最后回退通用文案
 * @param payload 响应体（已解析或原始字符串）
 * @param status HTTP 状态码
 * @param label 业务标识（如 Seedance / Seedream），用于回退文案
 */
export function parseHuyaArtApiError(payload: unknown, status: number, label: string): string {
    if (payload && typeof payload === "object") {
        const errorPayload = payload as HuyaArtErrorPayload;

        if (typeof errorPayload.error === "string" && errorPayload.error.trim()) {
            return errorPayload.error;
        }

        if (errorPayload.error && typeof errorPayload.error === "object" && errorPayload.error.message) {
            return errorPayload.error.message;
        }

        if (errorPayload.message) {
            return errorPayload.message;
        }
    }

    if (typeof payload === "string" && payload.trim()) {
        return payload;
    }

    return `${label} 请求失败（HTTP ${status}）`;
}

/**
 * 调用虎牙 art API：自动拼接 base url 与 Authorization 头
 * @param path 相对 HUYA_ART_BASE_URL 的路径（以 / 开头）
 * @param init fetch 选项
 * @param apiKeyOverride 客户端传入的 Key（优先于服务端环境变量）
 */
export async function huyaArtFetch(
    path: string,
    init: RequestInit = {},
    apiKeyOverride?: string,
): Promise<Response> {
    const apiKey = resolveHuyaArtApiKey(apiKeyOverride);

    return fetch(`${env.HUYA_ART_BASE_URL}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(init.headers ?? {}),
        },
    });
}

// HuyaArtSubmitResult 虎牙提交任务的返回（取 task_id）
type HuyaArtSubmitResult = {
    task_id?: string | number;
    id?: string | number;
    status?: string;
    error?: unknown;
    message?: string;
};

// HuyaArtPollResult 虎牙轮询结果的返回（success 时 results 含生成产物）
export type HuyaArtPollResult = {
    id?: string | number;
    status?: string;
    progress?: number | null;
    results?: Array<{ url?: string; type?: string; extension?: string | null }>;
    error?: unknown;
    created_at?: string;
    elapsed_time?: number;
    parameters?: Record<string, unknown>;
};

// HuyaArtSubmitAndPollOptions 服务端内部轮询选项
type HuyaArtSubmitAndPollOptions = {
    maxWaitMs?: number;
    intervalMs?: number;
    label?: string;
};

/**
 * 提交虎牙生成任务并轮询至完成（供图片同步返回等场景使用）
 * 1. POST /generate/image 提交，取 task_id
 * 2. 循环 GET /generate/result/{task_id}，status==="success" 返回 payload，失败抛错，超时抛"生成超时"
 * @param submitBody 提交请求体（{model, parameters}）
 * @param apiKeyOverride 客户端传入的 Key
 * @param options 轮询超时与间隔
 */
export async function huyaArtSubmitAndPoll(
    submitBody: unknown,
    apiKeyOverride?: string,
    options: HuyaArtSubmitAndPollOptions = {},
): Promise<HuyaArtPollResult> {
    const { maxWaitMs = 90_000, intervalMs = 3_000, label = "生成" } = options;

    const submitResponse = await huyaArtFetch(
        "/generate/image",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitBody),
        },
        apiKeyOverride,
    );

    const submitPayload = (await submitResponse.json().catch(() => null)) as HuyaArtSubmitResult | null;

    if (!submitResponse.ok) {
        throw new Error(parseHuyaArtApiError(submitPayload, submitResponse.status, label));
    }

    const taskId = submitPayload?.task_id ?? submitPayload?.id;

    if (taskId === undefined || taskId === null || String(taskId).trim() === "") {
        throw new Error(`${label} 未返回任务 ID`);
    }

    const deadline = Date.now() + maxWaitMs;

    // 首次轮询前等待一个间隔，避免任务刚提交还未就绪
    await sleep(Math.min(intervalMs, 1000));

    while (Date.now() < deadline) {
        const pollResponse = await huyaArtFetch(
            `/generate/result/${taskId}`,
            { method: "GET" },
            apiKeyOverride,
        );

        const pollPayload = (await pollResponse.json().catch(() => null)) as HuyaArtPollResult | null;

        if (!pollResponse.ok) {
            throw new Error(parseHuyaArtApiError(pollPayload, pollResponse.status, label));
        }

        if (!pollPayload) {
            await sleep(intervalMs);
            continue;
        }

        const status = typeof pollPayload.status === "string" ? pollPayload.status : "";

        if (status === "success") {
            return pollPayload;
        }

        if (status === "failed" || status === "error" || pollPayload.error) {
            throw new Error(parseHuyaArtApiError(pollPayload, pollResponse.status, label));
        }

        await sleep(intervalMs);
    }

    throw new Error(`${label}超时`);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
