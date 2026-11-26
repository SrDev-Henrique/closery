"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

// Copiar e compartilhar um link que aparece uma vez só (convite, nova senha).
// `canShare` só vale depois de montar: no servidor `navigator` não existe e o
// HTML inicial precisa ser igual ao do cliente.
export function useShareLink({
  url,
  shareTitle,
  shareText,
}: {
  url: string;
  shareTitle: string;
  shareText: string;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url });
    } catch (error) {
      // Fechar a folha de compartilhamento não é erro.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return { canShare, copy, share };
}
