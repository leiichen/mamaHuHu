import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 应用部署子路径（Vite base，需以 / 开头并以 / 结尾）
const APP_BASE = "/huyueyinghua/";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        {
            // 把无末尾斜杠的子路径访问 301 重定向到带斜杠形式
            // 例如 /huyueyinghua -> /huyueyinghua/，便于直接用裸路径打开应用
            name: "redirect-base-without-slash",
            configureServer(server) {
                const bareBase = APP_BASE.replace(/\/$/, "");

                server.middlewares.use((req, res, next) => {
                    const url = req.url ?? "";

                    if (url === bareBase || url.startsWith(`${bareBase}?`)) {
                        res.writeHead(301, { Location: `${APP_BASE}${url.slice(bareBase.length)}` });
                        res.end();
                        return;
                    }

                    next();
                });
            },
        },
    ],
    base: APP_BASE,
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 12345,
        // 监听所有网卡，允许局域网内其他机器通过本机 IP 访问（配合 host: true）
        host: true,
    },
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.ts"],
    },
});
