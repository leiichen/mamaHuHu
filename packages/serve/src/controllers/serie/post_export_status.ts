import type { AuthRequest } from "../../middleware/jwt.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateMiddleware } from "../../middleware/validate.js";
import { pollSerieExportSchema, type PollSerieExportInput } from "../../validators/serie.js";
import { pollSerieExport } from "../../services/serieExport.js";
import { success } from "../../utils/response.js";

export const middleware = [validateMiddleware(pollSerieExportSchema)];

// 轮询分集导出任务状态
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const { project_id: projectId, serie_id: serieId, job_id: jobId } = req.body as PollSerieExportInput;

    const result = pollSerieExport(req.user!.userId, projectId, serieId, jobId);

    return success(res, result, "ok");
});
