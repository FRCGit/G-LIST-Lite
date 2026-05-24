/** @type {import("next").NextConfig} */
const nextConfig = {
  assetPrefix: process.env.NODE_ENV === "production" ? "/next-static" : undefined,
  output: "export",
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
