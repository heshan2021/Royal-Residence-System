import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import PasswordGate from "./PasswordGate";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Royal Residence | Dashboard",
  description: "Modern receptionist management dashboard for Royal Residence",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <PasswordGate>
          {children}
        </PasswordGate>
      </body>
    </html>
  );
}
