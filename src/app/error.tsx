"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/logServerError";

type ErrorPageProps = {
  error: unknown;
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    logServerError(error, "error-boundary");
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <Button onClick={() => retry()}>Tentar de novo</Button>
    </main>
  );
}
