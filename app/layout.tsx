import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-figma-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-figma-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Open Dots",
  description:
    "A picture-book canvas. Draw the scene, place words and shapes, then present the story.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`min-h-full ${inter.className}`}>{children}</body>
    </html>
  );
}
