import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const tsnas = localFont({
  src: "./fonts/tsnas-bold.otf",
  variable: "--font-tsnas",
  weight: "700", // The font is already bold
  display: "swap",
});

export const metadata: Metadata = {
  title: "سماوة | نظام إدارة المشاريع",
  description: "منصة سماوة لإدارة المشاريع والمهام للفرق",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${tsnas.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster richColors position="top-center" expand />
      </body>
    </html>
  );
}
