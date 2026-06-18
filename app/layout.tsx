import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/app/_components/app-header";
import { AuthProvider } from "@/app/_components/auth-provider";
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
  title: {
    default: "Wine Envelope",
    template: "%s",
  },
  description: "와인 검색용 정보 페이지와 개인 테이스팅 노트를 분리한 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(212,212,216,0.35),_transparent_32%)]" />
            <AppHeader />
            <div className="relative z-10">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
