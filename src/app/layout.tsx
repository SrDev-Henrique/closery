import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// A variável precisa ser --font-sans: é o nome que o globals.css (shadcn) lê.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Satoshi (display, títulos e rótulos). Os arquivos vêm de `bun run fonts` (src/fonts/satoshi, fora do
// git por causa da licença). Os caminhos têm de ser literais: o next/font os resolve na compilação.
const satoshi = localFont({
  src: [
    {
      path: "../fonts/satoshi/Satoshi-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/satoshi/Satoshi-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/satoshi/Satoshi-900.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
  fallback: ["Geist", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: { template: "%s | Closery", default: "Closery" },
  description: "Passagem de turno simples, detalhada e rastreável.",
  // Piloto interno: fora dos buscadores (par do robots.ts e do X-Robots-Tag).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${satoshi.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
