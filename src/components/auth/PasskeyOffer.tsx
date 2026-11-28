"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { authFormError, errorCodeOf } from "./authFormError";
import { passkeyErrorCode } from "./passkeyErrorCode";

export function PasskeyOffer() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: passkeyError } = await authClient.passkey.addPasskey();
      if (passkeyError) {
        setError(
          authFormError(passkeyErrorCode(errorCodeOf(passkeyError), "register"))
            .message,
        );
        setPending(false);
        return;
      }
      toast.success("Passkey criada.");
      router.push("/");
    } catch {
      setError(authFormError(null).message);
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Conta criada
        </CardTitle>
        <CardDescription>
          A passkey é a forma mais rápida de entrar: você usa a digital, o rosto
          ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao
          administrador um link para criar outra.
        </CardDescription>
      </CardHeader>
      {error && (
        <CardContent>
          <FieldError>{error}</FieldError>
        </CardContent>
      )}
      <CardFooter className="flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={handleCreate}
        >
          Criar passkey
        </Button>
        {/* Hover local no escuro (P109): o rodapé já é accent/50, e o
            dark:hover:bg-accent/50 do ghost por cima dava 1,04:1 (o accent
            opaco, 1,09:1). O input/50 do outline dá 1,26:1; no claro o
            hover:bg-accent do ghost dá 1,11:1 e fica. Guarda:
            themeContrast.test.ts, que lê as classes renderizadas. */}
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "w-full sm:w-auto dark:hover:bg-input/50",
          )}
        >
          Agora não
        </Link>
      </CardFooter>
    </Card>
  );
}
