import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/lib/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The landing page's two voices: Plex Mono is the machine (SQL, agents, data),
// Instrument Sans is the human (questions, prose, answers).
const plexMono = IBM_Plex_Mono({
  variable: "--font-machine",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-human",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexusBI — Autonomous Multi-Agent BI Analyst",
  description:
    "Ask a business question in plain English. NexusBI writes the SQL, blocks anything that isn't read-only, repairs its own failed queries, and returns an executive answer you can audit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plexMono.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
