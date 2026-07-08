import type { AuthRequest } from "../../middleware/jwt.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { readHuyaArtApiKeyFromRequest } from "../../lib/huyaArtApiKey.js";
import { validateMiddleware } from "../../middleware/validate.js";
import { buildSeedanceGenerateBody } from "../../lib/buildSeedanceGenerateBody.js";
import { getSerieFragmentRowById, listSerieFragmentReferenceAssetsByFragmentId } from "../../services/serieFragment.js";
import { submitSerieFragmentSeedanceTask } from "../../services/serieGeneration.js";
import { generateSerieSchema, type GenerateSerieInput } from "../../validators/serie.js";
import { success } from "../../utils/response.js";

export const middleware = [validateMiddleware(generateSerieSchema)];

// 提交分镜 Seedance 视频生成任务
export const handler = asyncHandler<AuthRequest>(async (req, res) => {
    const {
        project_id: projectId,
        serie_id: serieId,
        fragment_id: fragmentId,
        content,
        model_id: modelId,
        aspect_ratio: aspectRatio,
        resolution,
        video_style_id: videoStyleId,
    } = req.body as GenerateSerieInput;

    const reference = await listSerieFragmentReferenceAssetsByFragmentId(fragmentId);
    // 读取分镜手动设定的目标时长（duration_sec），优先于 content 内 @duration 标签
    const fragmentRow = await getSerieFragmentRowById(serieId, fragmentId);
    const seedanceBody = buildSeedanceGenerateBody({
        content,
        reference,
        model_id: modelId,
        aspect_ratio: aspectRatio,
        resolution,
        video_style_id: videoStyleId,
        ...(typeof fragmentRow?.duration_sec === "number"
            ? { targetDurationSec: fragmentRow.duration_sec }
            : {}),
    });

    const huyaArtApiKey = readHuyaArtApiKeyFromRequest(req);
    const result = await submitSerieFragmentSeedanceTask(
        req.user!.userId,
        projectId,
        serieId,
        fragmentId,
        seedanceBody,
        huyaArtApiKey,
    );

    return success(res, result, "生成任务已提交");
});
