import type { Metadata, Viewport } from "next";
import { Nunito, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mother Tongue 母语",
  description:
    "You'll never sound like a native speaker. You can sound like yourself.",
};

export const viewport: Viewport = {
  themeColor: "#fdf4e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${notoSC.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
