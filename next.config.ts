import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** Baseline hardening; CSP in report-only mode for now. */
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://api.openai.com https://api.anthropic.com https://api.stripe.com wss://*.supabase.co",
      "frame-src 'self' https://js.stripe.com",
    ].join("; "),
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
