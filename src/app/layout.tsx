import type { Metadata } from "next";
import "./globals.css";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: `${publicEnv.appName} — Find your PI. Build your story. Manage your application.`,
  description:
    "STEM-member-only graduate school application copilot for SNU engineering students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
