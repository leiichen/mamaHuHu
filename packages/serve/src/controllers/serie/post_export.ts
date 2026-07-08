import type { AuthRequest } from "../../middleware/jwt.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateMiddleware } from "../../middleware/validate.js";
import { exportSerieSchema, type ExportSerieInput } from "../../validators/serie.js";
import { submitSerieExport } from "../../services/serieExport.js";
import { success } from "../../utils/response.js";

export const middleware = [validateMiddleware(exportSerieSchema)];

// 提交分集完整视频导出任务
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const { project_id: projectId, serie_id: serieId } = req.body as ExportSerieInput;

    const result = await submitSerieExport(req.user!.userId, projectId, serieId);

    return success(res, result, "导出任务已提交");
});
