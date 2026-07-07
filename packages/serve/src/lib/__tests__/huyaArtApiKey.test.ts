import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env.js", () => ({
    env: {
        HUYA_ART_API_KEY: "env-default-key",
    },
}));

import {
    readHuyaArtApiKeyHeader,
    resolveHuyaArtApiKey,
    isServerHuyaArtApiKeyConfigured,
} from "../huyaArtApiKey.js";

describe("huyaArtApiKey", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("优先使用客户端传入的 Key", () => {
        expect(resolveHuyaArtApiKey("client-key")).toBe("client-key");
    });

    it("客户端未传时回退到环境变量", () => {
        expect(resolveHuyaArtApiKey()).toBe("env-default-key");
        expect(resolveHuyaArtApiKey("   ")).toBe("env-default-key");
    });

    it("读取并裁剪请求头中的 Key", () => {
        expect(readHuyaArtApiKeyHeader("  abc  ")).toBe("abc");
        expect(readHuyaArtApiKeyHeader(["  def  "])).toBe("def");
        expect(readHuyaArtApiKeyHeader(undefined)).toBeUndefined();
    });

    it("判断服务端是否已配置 Key", () => {
        expect(isServerHuyaArtApiKeyConfigured()).toBe(true);
    });
});
