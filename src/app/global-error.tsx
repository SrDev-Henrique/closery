"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/logServerError";

import "./globals.css";

type GlobalErrorProps = {
  error: unknown;
  retry: () => void;
};

// Substitui o layout raiz quando ele mesmo quebra: precisa do próprio
// <html><body> e importa o CSS global (o layout não está ativo). Limite de erro
// não aceita `metadata`: o <title> é o do React 19 (vai para o <head>). O erro
// vai pelo logServerError (ponto único do log e do Sentry) e a mensagem dele
// nunca aparece na tela.
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    logServerError(error, "global-error");
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-full flex-col">
        <title>Algo deu errado</title>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Algo deu errado
          </h1>
          <Button onClick={() => retry()}>Tentar de novo</Button>
        </main>
      </body>
    </html>
  );
}
