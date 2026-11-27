"use client";

import { useSyncExternalStore } from "react";

import { readTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

// O snapshot do servidor é "dark", o mesmo do primeiro render do cliente: sem mismatch na hidratação.
// Depois de montar, o React relê a classe do <html> (que o script do <head> já acertou).
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readTheme,
    (): Theme => "dark",
  );
  return { theme, setTheme };
}
