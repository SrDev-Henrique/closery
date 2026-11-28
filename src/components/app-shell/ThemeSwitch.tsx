"use client";

import { Moon, Sun } from "lucide-react";
import { useSpring } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MOTION_SPRING } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useTheme } from "@/lib/useTheme";

// Switch estilo Apple (spec §4.2): trilho 76x44 em `card`, knob de 36px em `primary` com ícone de 16px.
// No escuro o knob fica à direita com a Lua; no claro, à esquerda com o Sol. A posição de repouso e o
// ícone vêm do CSS (`dark:`), que o script do <head> (src/lib/theme.ts) decide ANTES da primeira
// pintura: quem usa o claro não vê o knob deslizar a cada carga nem na hidratação. O deslize é só da
// troca (Motion, FLIP): no clique o CSS já põe o knob no lado novo; ele volta para onde estava (x = a
// diferença dos `offsetLeft`, mais o x de um deslize em curso) e a mola `MOTION_SPRING.knob` o leva a
// 0. Com movimento reduzido, troca na hora. O `aria-checked` e o rótulo do tooltip vêm do `useTheme`,
// cujo snapshot do servidor é "escuro" (igual ao HTML) e que relê o navegador logo depois de hidratar.
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const reduce = usePrefersReducedMotion();
  const knob = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, MOTION_SPRING.knob);

  function toggle() {
    const element = knob.current;
    const before = element ? element.offsetLeft + x.get() : 0;
    setTheme(isDark ? "light" : "dark");
    if (reduce || !element) return;
    const from = before - element.offsetLeft;
    if (from === 0) return;
    x.jump(from);
    x.set(0);
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Tema escuro"
            onClick={toggle}
            className="relative h-11 w-19 shrink-0 rounded-full bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <m.span
          ref={knob}
          aria-hidden="true"
          data-slot="theme-switch-knob"
          style={{ x }}
          className="absolute top-1 left-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground dark:left-9"
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
        </m.span>
      </TooltipTrigger>
      <TooltipContent>
        {isDark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      </TooltipContent>
    </Tooltip>
  );
}
