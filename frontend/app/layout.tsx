import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const eUkraine = localFont({
  src: [
    {
      path: "./fonts/e-Ukraine-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/e-Ukraine-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/e-Ukraine-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-e-ukraine",
});

export const metadata: Metadata = {
  title: "Hack the Classroom",
  description: "Interactive educational platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${eUkraine.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
