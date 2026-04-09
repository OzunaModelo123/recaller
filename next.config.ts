import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** Baseline hardening; CSP omitted (Next.js + inline scripts need a tuned policy). */
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "@react-pdf/renderer",
    "ffmpeg-static",
    "ffprobe-static",
    "pdf-parse",
    "pdfjs-dist",
  ],
  async headers() {
    const h = [...securityHeaders];
    if (process.env.VERCEL_ENV === "production") {
      h.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: h }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/sentry-tunnel",
});
