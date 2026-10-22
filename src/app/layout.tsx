import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProofTrail — evidence that holds together",
    template: "%s · ProofTrail",
  },
  description:
    "ProofTrail extracts source-linked facts from transaction evidence, surfaces discrepancies, and produces a professional case report for dispute review.",
  applicationName: "ProofTrail",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e6b5e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
