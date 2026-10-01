import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: ["pdf-parse"],

    experimental: {
        // Uploads pass through proxy.ts, so raise its default 10 MB body buffer.
        proxyClientMaxBodySize: "55mb",
    },

    turbopack: {
        resolveAlias: {
            canvas: { browser: "./empty-module.js", default: "./empty-module.js" },
        },
    },
};

export default nextConfig;
