import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE NEWSROOM by BR4N",
  description: "THE NEWSROOM by BR4N — personal entertainment news research desk for movies/TV and gaming.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
