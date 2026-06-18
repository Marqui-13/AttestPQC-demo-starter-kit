import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve ||= {};
    config.resolve.alias ||= {};
    config.resolve.alias["@tanstack/query-core"] = path.dirname(
      require.resolve("@tanstack/query-core/package.json")
    );
    return config;
  }
};

module.exports = nextConfig;
