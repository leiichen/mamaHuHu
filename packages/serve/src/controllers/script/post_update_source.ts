import type { AuthRequest } from "../../middleware/jwt.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateMiddleware } from "../../middleware/validate.js";
import { updateScriptSourceSchema, type UpdateScriptSourceInput } from "../../validators/script.js";
import { scriptService } from "../../services/script.js";
import { success } from "../../utils/response.js";

export const middleware = [validateMiddleware(updateScriptSourceSchema)];

// 更新剧本原始创意并重置大纲状态，触发重新生成
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const { project_id: projectId, source } = req.body as UpdateScriptSourceInput;
    const result = await scriptService.updateSource(req.user!.userId, projectId, source);

    return success(res, result, "创意已更新");
});
