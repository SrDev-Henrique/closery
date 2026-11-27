"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const subscribe = () => () => {};

// `false` no servidor e na hidratação, `true` depois de montar: o estado lido do navegador (localStorage)
// só vale depois disso, senão o HTML do servidor e o do cliente divergem.
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

// Switch estilo Apple (spec §4.2): trilho 76x44 em `card`, knob de 36px em `primary` com ícone de 16px.
// No escuro o knob fica à direita com a Lua; no claro, à esquerda com o Sol. A posição e o ícone vêm do
// CSS (`dark:`), que o script do next-themes decide ANTES da primeira pintura: quem usa o claro não vê
// o knob deslizar a cada carga. Só o `aria-checked` e o rótulo do tooltip esperam o estado do navegador
// (até lá, "escuro", igual ao HTML do servidor).
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = !mounted || resolvedTheme !== "light";

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
