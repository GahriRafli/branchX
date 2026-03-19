import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheLeads - Enterprise Task Management",
  description: "Centralized task management and document intelligence dashboard. Upload Excel, CSV, and PDF files to auto-generate actionable task workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
