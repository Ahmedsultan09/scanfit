import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@scanfit/browser/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScanFit · Next.js example",
  description: "Local scan-to-PDF workflow in the Next.js App Router",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
