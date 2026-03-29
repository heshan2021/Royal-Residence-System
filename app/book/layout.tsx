import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Royal Residence | Luxury Accommodations",
  description: "Experience unparalleled luxury at Royal Residence. Book your stay in our premium suites and rooms.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function BookLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {/* Public booking engine - no PasswordGate */}
        {children}
      </body>
    </html>
  );
}