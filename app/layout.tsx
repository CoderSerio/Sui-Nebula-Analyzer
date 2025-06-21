import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sui Observer",
  description:
    "基于 NebulaGraph 的智能地址关联识别平台，通过交易模式分析发现潜在关联地址",
  generator: "I and my LLM friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
