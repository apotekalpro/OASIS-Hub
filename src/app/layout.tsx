import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { PWARegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "OASIS Hub",
  description: "Internal Team & Task Management System",
  icons: {
    icon: "/icon-192-v2.png",
    apple: "/icon-192-v2.png",
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
      <head>
        {/* Capture beforeinstallprompt synchronously — before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaInstallPrompt = e;
            window.__pwaInstallReady = true;
          });
        `}} />
      </head>
      <body className={`${GeistSans.variable} font-sans min-h-full`}>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
