import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Browsafex",
  description: "Web UI for Gemini-powered browser automation agent",
  authors: [{ name: "Vladimit Haltakov", url: "https://haltakov.net" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#161616]">
      <body className={`${roboto.className} antialiased`}>{children}</body>
    </html>
  );
}
