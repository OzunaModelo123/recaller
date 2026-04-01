import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppAnalytics } from "@/components/analytics/app-analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recaller — AI-Powered Training Execution",
  description:
    "Transform training content into actionable learning plans. Ingest videos, docs, and articles — AI generates step-by-step plans your team actually completes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body
        className={`min-h-full flex flex-col ${geistSans.className}`}
      >
        {children}
        <AppAnalytics />
      </body>
    </html>
  );
}
