import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小程序交互卡片预览",
  description: "小程序交互卡片可视化预览",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
