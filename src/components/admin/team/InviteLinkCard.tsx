"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";

export function InviteLinkCard({
  url,
  expiresAt,
  onReset,
}: {
  url: string;
  expiresAt: Date;
  onReset: () => void;
}) {
  // Só depois de montar: no servidor `navigator` não existe e o HTML inicial
  // precisa ser igual ao do cliente.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  // O cartão substitui o formulário que tinha o foco: leva o foco ao título
  // (leitor de tela anuncia "Convite gerado" e a pessoa segue dali).
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
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
      await navigator.share({
        title: "Convite para o Closery",
        text: "Você foi convidado para o Closery.",
        url,
      });
    } catch (error) {
      // Fechar a folha de compartilhamento não é erro.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="invite-link-title"
    >
      <h3
        id="invite-link-title"
        ref={titleRef}
        tabIndex={-1}
        className="text-base font-medium outline-none"
      >
        Convite gerado
      </h3>
      <Input
        readOnly
        value={url}
        aria-label="Link do convite"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="text-sm text-muted-foreground">
        Válido até {formatDateTimeBR(expiresAt)}. O link aparece só agora: se
        perder, cancele o convite e gere outro.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          Copiar link
        </Button>
        {canShare && (
          <Button type="button" variant="outline" onClick={share}>
            Compartilhar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onReset}>
          Gerar outro convite
        </Button>
      </div>
    </section>
  );
}
