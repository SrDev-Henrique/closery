"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";

// Detalhe rápido da solicitação: o Sheet da rota interceptada. `open` é
// constante (o slot só existe enquanto a URL é a do detalhe): estado local não
// reabriria sob a Activity. Fechar = voltar no histórico, uma vez só: a trava
// impede dois router.back() (Escape + Fechar, ou fundo + Escape) antes de a
// navegação terminar, que tirariam a pessoa da tela de baixo.
export function RequestSheet({ children }: { children: ReactNode }) {
  const router = useRouter();
  const closing = useRef(false);

  // Roda de novo quando a Activity revela o slot outra vez.
  useEffect(() => {
    closing.current = false;
  }, []);

  function handleOpenChange(open: boolean) {
    if (open || closing.current) return;
    closing.current = true;
    router.back();
  }

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        // `data-[side=right]:w-full` troca o `w-3/4` do Sheet (o `w-full`
        // sozinho perde para o seletor de atributo): no celular o painel ocupa
        // a tela e os botões de status não ficam cortados na borda.
        className="w-full overflow-y-auto p-4 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <div className="flex justify-end">
          <SheetClose
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-md:h-11"
              />
            }
          >
            Fechar
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
