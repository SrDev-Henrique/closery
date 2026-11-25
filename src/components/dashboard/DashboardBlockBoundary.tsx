"use client";

import { catchError, type ErrorInfo } from "next/error";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// O bloco que quebra mostra isto no lugar dele; os outros seguem. `retry()`
// busca o bloco de novo sem perder o estado de fora do limite.
export function DashboardBlockError(
  { title }: { title: string },
  { retry }: ErrorInfo,
) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Alert variant="destructive">
        <AlertDescription>
          Não foi possível carregar este bloco.
        </AlertDescription>
      </Alert>
      <div>
        <Button type="button" variant="outline" onClick={() => retry()}>
          Tentar de novo
        </Button>
      </div>
    </section>
  );
}

export const DashboardBlockBoundary = catchError(DashboardBlockError);
