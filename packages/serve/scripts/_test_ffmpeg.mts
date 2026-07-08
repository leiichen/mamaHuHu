import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "node:fs";
import { extractFirstFrameToBuffer } from "../src/lib/videoProcess.js";
import { qiniuService } from "../src/services/qiniu.js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });

console.log("ffmpeg-static path:", ffmpegStatic);
console.log("ffmpeg exists:", ffmpegStatic ? existsSync(ffmpegStatic) : "null path");

// Download the actual video from qiniu and test frame extraction
const videoKey = "/xiaomaque/video/5746c57f-bc4d-40e0-9b95-ca7a844c92a4.mp4";
const signedUrl = qiniuService.resolvePrivateDownloadUrl(videoKey);
console.log("signed video url (tail):", signedUrl.slice(-60));

try {
  const resp = await fetch(signedUrl);
  console.log("fetch status:", resp.status);
  const buf = Buffer.from(await resp.arrayBuffer());
  console.log("video bytes:", buf.length);
  const frame = await extractFirstFrameToBuffer(buf);
  console.log("frame bytes:", frame.length, "magic:", frame.slice(0,4).toString("hex"));
} catch (e) {
  console.log("FRAME EXTRACTION ERROR:", e instanceof Error ? e.message : e);
}
