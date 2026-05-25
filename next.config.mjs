/** @type {import("next").NextConfig} */
const nextConfig = {
  assetPrefix: process.env.NODE_ENV === "production" ? "/next-static" : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate"
          },
          {
            key: "Pragma",
            value: "no-cache"
          },
          {
            key: "Expires",
            value: "0"
          }
        ]
      }
    ];
  },
  output: "export",
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
