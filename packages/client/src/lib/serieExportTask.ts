// 分集视频导出任务 localStorage 持久化（每分集至多一条）

// SERIE_EXPORT_TASKS_KEY localStorage 键名
const SERIE_EXPORT_TASKS_KEY = "xyq_serie_export_tasks_v1";

// SerieExportTaskRecord 导出任务记录
export type SerieExportTaskRecord = {
    projectId: number;
    serieId: number;
    jobId: string;
    createdAt: number;
};

// 读取 localStorage 中的全部导出任务记录
function readAllSerieExportTasks(): SerieExportTaskRecord[] {
    try {
        const raw = localStorage.getItem(SERIE_EXPORT_TASKS_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw) as unknown;

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.flatMap((item) => {
            if (!item || typeof item !== "object") {
                return [];
            }

            const record = item as Record<string, unknown>;

            if (
                typeof record.projectId !== "number" ||
                typeof record.serieId !== "number" ||
                typeof record.jobId !== "string" ||
                typeof record.createdAt !== "number"
            ) {
                return [];
            }

            return [
                {
                    projectId: record.projectId,
                    serieId: record.serieId,
                    jobId: record.jobId,
                    createdAt: record.createdAt,
                },
            ];
        });
    } catch {
        return [];
    }
}

// 写入 localStorage 任务列表
function writeAllSerieExportTasks(tasks: SerieExportTaskRecord[]) {
    localStorage.setItem(SERIE_EXPORT_TASKS_KEY, JSON.stringify(tasks));
}

// 读取指定分集的导出任务
export function readSerieExportTask(serieId: number): SerieExportTaskRecord | null {
    return readAllSerieExportTasks().find((task) => task.serieId === serieId) ?? null;
}

// 保存或更新分集导出任务（每分集仅一条）
export function upsertSerieExportTask(task: SerieExportTaskRecord) {
    const tasks = readAllSerieExportTasks().filter((item) => item.serieId !== task.serieId);

    tasks.push(task);
    writeAllSerieExportTasks(tasks);
}

// 删除分集导出任务
export function removeSerieExportTask(serieId: number) {
    const tasks = readAllSerieExportTasks().filter((item) => item.serieId !== serieId);

    writeAllSerieExportTasks(tasks);
}
