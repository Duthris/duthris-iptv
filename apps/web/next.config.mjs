const isDesktop = process.env.BUILD_TARGET === "desktop";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  output: isDesktop ? "export" : undefined,

  pageExtensions: isDesktop ? ["tsx", "ts"] : ["tsx", "ts", "api.ts"],

  transpilePackages: ["@iptv/core", "@iptv/db", "@iptv/ui"],

  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
