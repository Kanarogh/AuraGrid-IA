import type { NextConfig } from "next";

/** Square Cloud reporta muitos cores com pouca RAM — limita workers do build. */
const buildWorkerCount = Number(process.env.NEXT_BUILD_CPUS ?? "1");

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "@aws-sdk/client-s3", "sharp"],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: buildWorkerCount,
    workerThreads: false,
  },
};

export default nextConfig;
