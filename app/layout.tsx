"use client";
import Script from "next/script";
import { LotteryProvider } from "./contexts/LotteryContext";
import { Navbar } from "./components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Telegram Web App Script */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive" // Ensures the script loads before the page becomes interactive
          onLoad={() => console.log("Telegram Web App script loaded")}
        />
      </head>
      <body>
        <LotteryProvider>
          <Navbar />
          <main className="w-full">{children}</main>
        </LotteryProvider>
      </body>
    </html>
  );
}
