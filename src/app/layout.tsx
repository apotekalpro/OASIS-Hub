import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/pwa-register";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "OASIS Hub",
  description: "Internal Team & Task Management System",
  icons: {
    icon: "/oasis-hub-logo.png",
    apple: "/oasis-hub-logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OASIS Hub",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans min-h-full`}>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
