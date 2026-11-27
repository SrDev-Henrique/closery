"use client";

import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { ThemeSwitch } from "@/components/app-shell/ThemeSwitch";

// Cabeçalho de 76px, sem borda. À esquerda o botão de menu (e, só abaixo de
// 860px, o wordmark); à direita o switch de tema. O wordmark usa `hidden
// max-md:inline`: `md` é 860px (Task 1), então ele só aparece no celular, onde
// a sidebar fixa não está na tela para mostrar o nome do app.
export function AppHeader() {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <MenuToggle />
        <span className="hidden font-heading text-2xl leading-none font-black tracking-[-0.03em] max-md:inline">
          Closery
        </span>
      </div>
      <ThemeSwitch />
    </header>
  );
}
