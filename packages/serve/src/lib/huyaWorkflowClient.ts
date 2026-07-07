import { env } from "../config/env.js";

/**
 * 海智 LLM 平台 Dify 风格 workflow 客户端
 * 对接 POST {HUYA_LLM_BASE_URL}/workflows/run（阻塞模式），用于短视频剧本大纲生成。
 */

// VIDEO_OUTLINE_INPUT_TEXT_KEY workflow inputs 中创意文本的变量名
// 已通过直连 workflow 确认：该应用要求 inputs.text（空 inputs 时报 "text is required in input form"）。
export const VIDEO_OUTLINE_INPUT_TEXT_KEY = "text";

// OUTLINE_OUTPUT_CANDIDATE_KEYS outputs 中大纲文本的候选 key（按优先级）
// 已确认 outputs.text 为 markdown 大纲，这里做容错，取首个字符串值。
const OUTLINE_OUTPUT_CANDIDATE_KEYS = ["text", "outline", "summary", "result", "剧情大纲"];

// VideoOutlineJson workflow 返回的结构化大纲（JSON 格式）
export type VideoOutlineJson = {
    story: string;
    characters: string[];
    scenes: string[];
    segmentPrompts?: Array<{
        scene: string;
        segment: string;
        characters: string[];
        prompts: string[];
    }>;
};

// HuyaWorkflowErrorPayload workflow 错误响应结构
type HuyaWorkflowErrorPayload = {
    error?: string;
    message?: string;
    data?: { error?: string; status?: string } | null;
};

/**
 * 解析 workflow 错误信息：兼容顶层 error / message / data.error
 * @param payload 响应体
 * @param status HTTP 状态码
 */
function parseWorkflowError(payload: unknown, status: number): string {
    if (payload && typeof payload === "object") {
        const errorPayload = payload as HuyaWorkflowErrorPayload;

        if (errorPayload.error) {
            return errorPayload.error;
        }

        if (errorPayload.message) {
            return errorPayload.message;
        }

        if (errorPayload.data?.error) {
            return errorPayload.data.error;
        }
    }

    if (typeof payload === "string" && payload.trim()) {
        return payload;
    }

    return `workflow 请求失败（HTTP ${status}）`;
}

// RunHuyaWorkflowOptions 调用 workflow 入参
type RunHuyaWorkflowOptions = {
    // inputs 应用定义的变量键值对
    inputs: Record<string, unknown>;
    // user 终端用户标识（应用内唯一）
    user: string;
    // responseMode 响应模式，默认 blocking
    responseMode?: "blocking" | "streaming" | "async";
};

// HuyaWorkflowBlockingResult blocking 模式响应
export type HuyaWorkflowBlockingResult = {
    workflowRunId: string;
    taskId: string;
    status: string;
    outputs: Record<string, unknown>;
    error: string | null;
    elapsedTime: number | null;
    totalTokens: number | null;
};

/**
 * 解析 blocking 模式响应体为结构化结果
 */
function parseBlockingResult(payload: unknown): HuyaWorkflowBlockingResult {
    const raw = (payload ?? {}) as {
        workflow_run_id?: string;
        task_id?: string;
        data?: {
            status?: string;
            outputs?: Record<string, unknown>;
            error?: string | null;
            elapsed_time?: number;
            total_tokens?: number;
        } | null;
    };

    return {
        workflowRunId: raw.workflow_run_id ?? "",
        taskId: raw.task_id ?? "",
        status: raw.data?.status ?? "",
        outputs: raw.data?.outputs ?? {},
        error: raw.data?.error ?? null,
        totalTokens: raw.data?.total_tokens ?? null,
        elapsedTime: raw.data?.elapsed_time ?? null,
    };
}

/**
 * 执行海智 workflow（阻塞模式）
 * @param options inputs / user / responseMode
 * @returns workflow 执行结果（含 outputs）
 */
export async function runHuyaWorkflow(
    options: RunHuyaWorkflowOptions,
): Promise<HuyaWorkflowBlockingResult> {
    if (!env.HUYA_LLM_API_KEY) {
        throw new Error("未配置 HUYA_LLM_API_KEY，无法调用海智 workflow");
    }

    const responseMode = options.responseMode ?? "blocking";

    if (responseMode !== "blocking") {
        throw new Error(`暂不支持的 response_mode：${responseMode}`);
    }

    const response = await fetch(`${env.HUYA_LLM_BASE_URL}/workflows/run`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.HUYA_LLM_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: options.inputs,
            response_mode: responseMode,
            user: options.user,
        }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(parseWorkflowError(payload, response.status));
    }

    const result = parseBlockingResult(payload);

    if (result.status === "failed" || result.error) {
        throw new Error(result.error || "workflow 执行失败");
    }

    return result;
}

/**
 * 从 workflow outputs 中容错提取大纲文本
 * 按候选 key 顺序取首个非空字符串值；若均为对象则取其首个字符串字段。
 * @param outputs workflow data.outputs
 */
export function extractOutlineText(outputs: unknown): string {
    if (!outputs || typeof outputs !== "object" || Array.isArray(outputs)) {
        return "";
    }

    const record = outputs as Record<string, unknown>;

    for (const key of OUTLINE_OUTPUT_CANDIDATE_KEYS) {
        const value = record[key];

        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    // 回退：取首个字符串字段
    for (const value of Object.values(record)) {
        if (typeof value === "string" && value.trim()) {
            return value;
        }
    }

    return "";
}

/**
 * 从 workflow outputs 中容错提取结构化大纲 JSON
 * 按候选 key 顺序取首个非空字符串，尝试解析为 JSON 并验证结构；
 * 若不为合法 JSON 或不含 characters / scenes 数组则返回 null（回退为纯文本大纲）。
 * @param outputs workflow data.outputs
 */
export function parseVideoOutlineJson(outputs: unknown): VideoOutlineJson | null {
    const text = extractOutlineText(outputs);

    if (!text.trim()) {
        return null;
    }

    // 尝试将文本解析为 JSON（workflow 可能返回 JSON 字符串）
    let parsed: unknown;

    try {
        parsed = JSON.parse(text.trim());
    } catch {
        // 若文本本身不是 JSON，尝试匹配 ```json ... ``` markdown 代码块
        const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);

        if (codeBlockMatch?.[1]) {
            try {
                parsed = JSON.parse(codeBlockMatch[1].trim());
            } catch {
                return null;
            }
        } else {
            return null;
        }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }

    const record = parsed as Record<string, unknown>;

    // 必须包含 characters 和 scenes 数组
    if (!Array.isArray(record.characters) || !Array.isArray(record.scenes)) {
        return null;
    }

    // story 为可选的顶层故事描述
    const story = typeof record.story === "string" ? record.story : "";

    // characters 为字符串数组
    const characters = record.characters.filter(
        (item): item is string => typeof item === "string",
    );

    // scenes 为字符串数组
    const scenes = record.scenes.filter(
        (item): item is string => typeof item === "string",
    );

    // segmentPrompts 为可选数组
    const segmentPrompts = Array.isArray(record.segmentPrompts)
        ? (record.segmentPrompts as VideoOutlineJson["segmentPrompts"])
        : undefined;

    if (characters.length === 0 && scenes.length === 0) {
        return null;
    }

    return {
        story,
        characters,
        scenes,
        ...(segmentPrompts ? { segmentPrompts } : {}),
    };
}
