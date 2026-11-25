"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type AppErrorProps = {
  error: unknown;
  retry: () => void;
};

// Erro de uma página de (app): aparece dentro do shell (a barra lateral
// continua ali). Sem <main>: o SidebarInset já é o <main>. O erro da raiz
// (src/app/error.tsx) fica para quem está fora do shell.
export default function AppError({ error, retry }: AppErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <Button onClick={() => retry()}>Tentar de novo</Button>
    </div>
  );
}
