import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Masulino",
  description: "Interne Buchung für Spielstätten",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
