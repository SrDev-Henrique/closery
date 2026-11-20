"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/client";
import { authFormError, errorCodeOf } from "./authFormError";
import { formatPasskeyDate } from "./passkeyDate";
import { passkeyErrorCode } from "./passkeyErrorCode";

export function PasskeyManager() {
  const {
    data,
    isPending: isLoading,
    error: loadError,
    refetch,
  } = authClient.useListPasskeys();
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = creating || removingId !== null;

  async function handleCreate() {
    if (busy) return;
    setCreating(true);
    setError(null);
    try {
      const { error: passkeyError } = await authClient.passkey.addPasskey();
      if (passkeyError) {
        setError(
          authFormError(passkeyErrorCode(errorCodeOf(passkeyError), "register"))
            .message,
        );
        return;
      }
      toast.success("Passkey criada.");
    } catch {
      setError(authFormError(null).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(id: string) {
    if (busy) return;
    setRemovingId(id);
    setError(null);
    try {
      const { error: removeError } = await authClient.passkey.deletePasskey({
        id,
      });
      if (removeError) {
        setError(authFormError(errorCodeOf(removeError)).message);
        return;
      }
      toast.success("Passkey removida.");
    } catch {
      setError(authFormError(null).message);
    } finally {
      setRemovingId(null);
    }
  }

  const passkeys = data ?? [];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="passkeys-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="passkeys-title" className="text-base font-medium">
          Passkeys
        </h2>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={handleCreate}
        >
          Criar passkey
        </Button>
      </div>

      {error && <FieldError>{error}</FieldError>}

      {loadError ? (
        <div className="flex flex-col items-start gap-2">
          <FieldError>{authFormError(null).message}</FieldError>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : isLoading ? (
        <div
          data-testid="passkeys-loading"
          aria-busy="true"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-12 w-full" />
        </div>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma passkey ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => {
            const created = formatPasskeyDate(passkey.createdAt);
            return (
              <li
                key={passkey.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {passkey.name || "Passkey"}
                  </span>
                  {created && (
                    <span className="text-sm text-muted-foreground">
                      Criada em {created}
                    </span>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover passkey"
                        disabled={busy}
                        onClick={() => handleRemove(passkey.id)}
                      />
                    }
                  >
                    <Trash2 />
                  </TooltipTrigger>
                  <TooltipContent>Remover passkey</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
