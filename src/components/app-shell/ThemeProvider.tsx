"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// O escuro é o padrão e o tema NÃO segue o sistema (C-V4): a escolha fica só no navegador, na chave
// `closery-tema`. A classe `dark` vai no <html> (o `@custom-variant dark` do globals.css). Em componente
// próprio para ser testável sem o RootLayout, que carrega as fontes (spec §4.3).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="closery-tema"
    >
      {children}
    </NextThemesProvider>
  );
}
