import type { AuthRequest } from "../../middleware/jwt.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateMiddleware } from "../../middleware/validate.js";
import { refillSerieCoversSchema, type RefillSerieCoversInput } from "../../validators/serie.js";
import { refillSerieFragmentCovers } from "../../services/serieCoverRefill.js";
import { success } from "../../utils/response.js";

export const middleware = [validateMiddleware(refillSerieCoversSchema)];

// 为分集下缺封面的已生成分镜回填首帧
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const { project_id: projectId, serie_id: serieId } = req.body as RefillSerieCoversInput;

    const result = await refillSerieFragmentCovers(req.user!.userId, projectId, serieId);

    return success(res, result, "封面回填完成");
});
