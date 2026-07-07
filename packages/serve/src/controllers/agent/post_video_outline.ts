import type { AuthRequest } from "../../middleware/jwt.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateMiddleware } from "../../middleware/validate.js";
import {
    generateScriptSummarySchema,
    type GenerateScriptSummaryInput,
} from "../../validators/script.js";
import { videoOutlineService } from "../../services/videoOutline.js";
import { success } from "../../utils/response.js";

export const middleware = [validateMiddleware(generateScriptSummarySchema)];

// 为已有剧本草稿调用海智 workflow 生成短视频剧情大纲并写回 summary 字段
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const { project_id: projectId } = req.body as GenerateScriptSummaryInput;
    const result = await videoOutlineService.generateOutline(req.user!.userId, projectId);

    return success(res, result, "短视频大纲生成成功");
});
