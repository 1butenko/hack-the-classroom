import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const fixelDisplay = localFont({
  src: [
    {
      path: "./fonts/FixelDisplay-Thin.otf",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/FixelDisplay-ExtraLight.otf",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/FixelDisplay-Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/FixelDisplay-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/FixelDisplay-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/FixelDisplay-SemiBold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/FixelDisplay-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-fixel-display",
  display: "swap",
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
      <body className={`${fixelDisplay.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}