import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "G-LIST",
  description: "A compact Gundam media tracker."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
