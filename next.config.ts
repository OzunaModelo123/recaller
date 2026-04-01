import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@react-pdf/renderer", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
