import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["tesseract.js", "unpdf", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/**": ["./assets/tessdata/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
