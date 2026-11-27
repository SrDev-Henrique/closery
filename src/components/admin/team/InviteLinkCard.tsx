"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";
import { useShareLink } from "./useShareLink";

export function InviteLinkCard({
  url,
  expiresAt,
  onReset,
}: {
  url: string;
  expiresAt: Date;
  onReset: () => void;
}) {
  const { canShare, copy, share } = useShareLink({
    url,
    shareTitle: "Convite para o Closery",
    shareText: "Você foi convidado para o Closery.",
  });

  // O cartão substitui o formulário que tinha o foco: leva o foco ao título
  // (leitor de tela anuncia "Convite gerado" e a pessoa segue dali).
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

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
