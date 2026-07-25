import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Agentic Kanban",
  description: "Tool-agnostic kanban where agents work the cards",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
