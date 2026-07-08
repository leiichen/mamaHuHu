// 视频处理：首帧提取与片段拼接（基于 ffmpeg-static 自带二进制，无需系统 PATH）
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegStatic from "ffmpeg-static";

// FFMPEG_PATH ffmpeg 可执行文件绝对路径
const FFMPEG_PATH = ffmpegStatic as unknown as string | null;

if (!FFMPEG_PATH) {
    throw new Error("未找到 ffmpeg-static 二进制，请检查 ffmpeg-static 安装");
}

// 视频统一规格（重编码中间产物）
const EXPORT_FPS = 30;
const EXPORT_SAMPLE_RATE = 44100;

// ConcatFragmentInput 待拼接的片段
export type ConcatFragmentInput = {
    buffer: Buffer;
    // hasAudio 是否含音频流；无则补静音轨以保证拼接时音频流统一
    hasAudio: boolean;
};

// ExportResolution 导出目标分辨率
export type ExportResolution = {
    width: number;
    height: number;
};

// 运行 ffmpeg（输出到文件），失败抛错（含 stderr 摘要）
function runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(FFMPEG_PATH as string, args, { windowsHide: true });

        let stderrText = "";

        proc.stderr.on("data", (chunk: Buffer) => {
            stderrText += chunk.toString("utf8");
        });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`ffmpeg 退出码 ${code}：${stderrText.slice(-500)}`));
        });
    });
}

// 创建临时目录
function makeTempDir(prefix: string): Promise<string> {
    return mkdtemp(join(tmpdir(), prefix));
}

// 探测临时文件是否含音频流（解析 ffmpeg -i 的 stderr Audio: 行）
export function probeFileHasAudio(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn(FFMPEG_PATH as string, ["-i", filePath, "-hide_banner"], {
            windowsHide: true,
        });

        let stderrText = "";

        proc.stderr.on("data", (chunk: Buffer) => {
            stderrText += chunk.toString("utf8");
        });
        proc.on("error", () => resolve(false));
        proc.on("close", () => {
            resolve(/Audio:\s/.test(stderrText));
        });
    });
}

/**
 * 提取视频首帧为 JPEG Buffer
 * 输入/输出均落临时文件（mp4/image2 对非可寻址 pipe 支持不佳）
 */
export async function extractFirstFrameToBuffer(videoBuffer: Buffer): Promise<Buffer> {
    const dir = await makeTempDir("xyq-frame-");
    const inputPath = join(dir, "in.mp4");
    const outputPath = join(dir, "frame.jpg");

    try {
        await writeFile(inputPath, videoBuffer);

        await runFfmpeg([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            inputPath,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            outputPath,
        ]);

        return await readFile(outputPath);
    } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
}

/**
 * 将多个片段拼接为一个 mp4 Buffer
 * 两步法：每个片段重编码为统一规格的中间文件 → concat demuxer stream copy 合并
 * 输出落临时文件（mp4 muxer 不支持非可寻址的 stdout pipe）
 */
export async function concatenateFragmentsToBuffer(
    inputs: ConcatFragmentInput[],
    resolution: ExportResolution,
): Promise<Buffer> {
    if (inputs.length === 0) {
        throw new Error("没有可拼接的片段");
    }

    // 单片段直接返回（已是合法 mp4）
    if (inputs.length === 1) {
        return inputs[0].buffer;
    }

    const dir = await makeTempDir("xyq-export-");

    try {
        const intermediatePaths: string[] = [];

        // 1. 每个片段重编码为统一规格
        for (let index = 0; index < inputs.length; index += 1) {
            const input = inputs[index];
            const inputPath = join(dir, `src-${index}.mp4`);
            const outputPath = join(dir, `mid-${index}.mp4`);
            await writeFile(inputPath, input.buffer);

            const args = [
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                inputPath,
            ];

            if (!input.hasAudio) {
                // 无音频：补静音轨，-shortest 让静音轨与视频等长
                args.push(
                    "-f",
                    "lavfi",
                    "-i",
                    `anullsrc=channel_layout=stereo:sample_rate=${EXPORT_SAMPLE_RATE}`,
                );
            }

            args.push(
                "-vf",
                `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${EXPORT_FPS},format=yuv420p`,
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-ar",
                String(EXPORT_SAMPLE_RATE),
                "-ac",
                "2",
            );

            if (!input.hasAudio) {
                args.push("-shortest");
            }

            args.push(outputPath);

            await runFfmpeg(args);
            intermediatePaths.push(outputPath);
        }

        // 2. concat demuxer stream copy 合并（输出落临时文件）
        const listPath = join(dir, "list.txt");
        const listContent = intermediatePaths
            .map((path) => `file '${path.replace(/'/g, "'\\''")}'`)
            .join("\n");
        await writeFile(listPath, listContent, "utf8");

        const outputPath = join(dir, `out-${randomUUID()}.mp4`);

        await runFfmpeg([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            listPath,
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            outputPath,
        ]);

        return await readFile(outputPath);
    } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
}

// EXPORT_RESOLUTION_MAP 清晰度到像素高度的映射
const EXPORT_RESOLUTION_MAP: Record<string, number> = {
    "480p": 480,
    "720p": 720,
    "1080p": 1080,
};

// 根据清晰度与比例推导导出分辨率（回退 720p · 9:16）
export function parseExportResolution(
    resolution?: string,
    aspectRatio?: string,
): ExportResolution {
    const height =
        typeof resolution === "string" && EXPORT_RESOLUTION_MAP[resolution]
            ? EXPORT_RESOLUTION_MAP[resolution]
            : 720;

    switch (aspectRatio) {
        case "16:9":
            return { width: Math.round((height * 16) / 9), height };
        case "21:9":
            return { width: Math.round((height * 21) / 9), height };
        case "4:3":
            return { width: Math.round((height * 4) / 3), height };
        case "9:16":
        default:
            return { width: Math.round((height * 9) / 16), height };
    }
}
