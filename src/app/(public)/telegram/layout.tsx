import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Beajee Mini App",
  description: "Beajee networking inside Telegram.",
};

export default function TelegramLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
