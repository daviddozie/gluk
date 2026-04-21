import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: ["pdf-parse"],

    turbopack: {
        resolveAlias: {
            canvas: { browser: "./empty-module.js", default: "./empty-module.js" },
        },
    },
};

export default nextConfig;