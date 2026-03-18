import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import AuthProvider from "@/components/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gluk.vercel.app"),

  title: {
    default: "Gluk – AI Research Agent for Fast, Deep Insights",
    template: "%s | Gluk AI",
  },

  description:
    "Gluk is an AI research agent that automates deep research, gathers information from multiple sources, and generates structured insights for developers, students, and researchers.",

  applicationName: "Gluk",

  keywords: [
    "AI research agent",
    "automated research tool",
    "AI assistant for research",
    "deep research AI",
    "research automation tool",
    "AI knowledge assistant",
  ],

  authors: [{ name: "David Dozie" }],
  creator: "David Dozie",
  publisher: "Gluk",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Gluk – AI Research Agent",
    description:
      "Automate deep research and generate structured insights with Gluk.",
    url: "https://gluk.vercel.app",
    siteName: "Gluk",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gluk AI Research Agent",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Gluk – AI Research Agent",
    description:
      "AI-powered research agent for fast, structured insights.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gluk",
  applicationCategory: "AIApplication",
  operatingSystem: "Web",
  description:
    "Gluk is an AI research agent that automates deep research, gathers information from multiple sources, and generates structured insights.",
  url: "https://gluk.vercel.app",
  creator: {
    "@type": "Person",
    name: "David Mgbede",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Script
          id="json-ld"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div style={{ display: "none" }}>
          Gluk is an AI research agent that automates deep research, gathers
          information from multiple sources, and generates structured insights
          for developers, students, and researchers.
        </div>

        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}