"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

// "Carregar mais" cresce o limite da coluna pela URL (?mais_<status>=N) sem
// rolar a página; `shown de total` vem do servidor.
export function LoadMoreButton({
  href,
  shown,
  total,
}: {
  href: string;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.replace(href, { scroll: false });
          })
        }
      >
        {pending ? "Carregando…" : "Carregar mais"}
      </Button>
      <p
        aria-live="polite"
        className="text-xs text-muted-foreground tabular-nums"
      >
        {shown} de {total}
      </p>
    </div>
  );
}
