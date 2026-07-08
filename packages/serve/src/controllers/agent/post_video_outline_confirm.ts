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

// 用户确认大纲后创建角色/场景资产并生成图片
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const { project_id: projectId } = req.body as GenerateScriptSummaryInput;
    const result = await videoOutlineService.confirmOutline(req.user!.userId, projectId);

    return success(res, result, "资产创建完成");
});
