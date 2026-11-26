"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { errorCodeOf } from "./authFormError";

const TOKEN_FRAGMENT = /^#token=([A-Za-z0-9_-]{16,256})$/;

// O token vem no fragmento (#token=...): o navegador nunca o envia ao servidor,
// então ele não entra em log da Vercel nem no Referer. Lido uma vez e apagado
// da barra de endereço (history.replaceState) para não ficar no histórico.
export function takeTokenFromLocation(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState">,
): string | null {
  const match = TOKEN_FRAGMENT.exec(location.hash);
  if (!match?.[1]) return null;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  return match[1];
}

type Phase = "reading" | "ready" | "missing" | "done";

export function ResetPasswordForm() {
  const uid = useId();
  const [phase, setPhase] = useState<Phase>("reading");
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Só no cliente e só depois de montar: o fragmento não existe no servidor.
  // Em StrictMode o efeito roda duas vezes; a segunda não acha mais o
  // fragmento (já apagado) e por isso nunca zera o token lido na primeira.
  useEffect(() => {
    const found = takeTokenFromLocation(window.location, window.history);
    if (found) {
      setToken(found);
      setPhase("ready");
    } else {
      setPhase((current) => (current === "reading" ? "missing" : current));
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    setPending(true);
    setError(null);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        setError(authErrorMessage(errorCodeOf(resetError)));
        setPending(false);
        return;
      }
      setPassword("");
      setPhase("done");
    } catch {
      setError(authErrorMessage(null));
      setPending(false);
    }
  }

  if (phase === "reading") {
    return <Card aria-busy="true" className="min-h-48" />;
  }

  if (phase === "missing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Link incompleto
          </CardTitle>
          <CardDescription>
            Abra o link de redefinição completo, do jeito que o administrador
            enviou. Se ele não funcionar, peça outro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/entrar"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Ir para a entrada
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Senha alterada
          </CardTitle>
          <CardDescription>
            Por segurança, todos os acessos abertos foram encerrados. Entre com
            a senha nova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/entrar" className={buttonVariants({ size: "lg" })}>
            Entrar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const errorId = `${uid}-error`;
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Criar uma senha nova
        </CardTitle>
        <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`${uid}-password`}>Senha nova</FieldLabel>
              <Input
                id={`${uid}-password`}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              {error && <FieldError id={errorId}>{error}</FieldError>}
            </Field>
            <Button type="submit" size="lg" disabled={pending}>
              Trocar a senha
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
