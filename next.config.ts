import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "@aws-sdk/client-s3"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
