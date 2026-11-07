import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FACILITY DEFENSE — Défendez le Core",
  description: "Un jeu de défense tactique en 2D avec ambiance industrielle, visée souris et escouades autonomes. Huit niveaux, infrastructures fonctionnelles, réseaux électriques, caméras et tourelles capturables. Une bataille autonome sans limite pour protéger le Core.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
