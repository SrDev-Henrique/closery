"use client";

import { Moon, Sun } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/lib/useTheme";

// Switch estilo Apple (spec §4.2): trilho 76x44 em `card`, knob de 36px em `primary` com ícone de 16px.
// No escuro o knob fica à direita com a Lua; no claro, à esquerda com o Sol. A posição e o ícone vêm do
// CSS (`dark:`), que o script do <head> (src/lib/theme.ts) decide ANTES da primeira pintura: quem usa o claro não vê
// o knob deslizar a cada carga. O `aria-checked` e o rótulo do tooltip vêm do `useTheme`, cujo snapshot do
// servidor é "escuro" (igual ao HTML) e que relê o navegador logo depois de hidratar.
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Tema escuro"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative h-11 w-19 shrink-0 rounded-full bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-[left] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none dark:left-9"
        >
          <Moon
            aria-hidden="true"
            strokeWidth={2.2}
            className="hidden size-4 dark:block"
          />
          <Sun
            aria-hidden="true"
            strokeWidth={2.2}
            className="size-4 dark:hidden"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {isDark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      </TooltipContent>
    </Tooltip>
  );
}
