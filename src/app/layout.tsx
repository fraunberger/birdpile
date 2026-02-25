import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Birdpile",
  description: "Discover the world of birds.",
  openGraph: {
    title: "Birdpile",
    description: "Discover the world of birds.",
    siteName: "Birdpile",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
