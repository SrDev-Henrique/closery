"use client";

import { useState } from "react";

import { createPasswordResetLinkAction } from "@/app/(app)/admin/equipe/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";
import { useShareLink } from "./useShareLink";

type ResetLink = { url: string; expiresAt: Date };

// Um clique gera o link e já mostra: o admin só precisa copiar ou compartilhar
// e mandar. O link aparece uma vez (o banco guarda só o hash); fechar o diálogo
// o descarta e gerar outro invalida o anterior.
export function PasswordResetLinkButton({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const { pending, run } = useAdminAction();
  const [link, setLink] = useState<ResetLink | null>(null);

  async function generate() {
    const result = await run(() =>
      createPasswordResetLinkAction({ userId: personId }),
    );
    if (result.ok) setLink({ url: result.url, expiresAt: result.expiresAt });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`Gerar link de nova senha para ${personName}`}
        onClick={generate}
      >
        Nova senha
      </Button>
      <Dialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) setLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de nova senha</DialogTitle>
            <DialogDescription>{personName}</DialogDescription>
          </DialogHeader>
          {link && <ResetLinkBody url={link.url} expiresAt={link.expiresAt} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResetLinkBody({ url, expiresAt }: ResetLink) {
  const { canShare, copy, share } = useShareLink({
    url,
    shareTitle: "Nova senha do Closery",
    shareText: "Abra este link para criar uma senha nova no Closery.",
  });

  return (
    <div className="flex flex-col gap-4">
      <Input
        readOnly
        value={url}
        aria-label="Link para copiar"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="text-sm text-muted-foreground">
        Válido até {formatDateTimeBR(expiresAt)}, uma vez só. Quem abrir o link
        troca a senha e todos os acessos abertos dessa pessoa são encerrados. O
        link aparece só agora: se perder, gere outro (o anterior deixa de
        valer).
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
      </div>
    </div>
  );
}
