import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BR4N Newsroom",
  description: "Personal entertainment news research desk — movies/TV and gaming.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
