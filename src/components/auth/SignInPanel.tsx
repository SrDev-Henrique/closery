"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
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
import type { SocialProvider } from "@/lib/auth/env";
import {
  type AuthFormError,
  authFormError,
  errorCodeOf,
} from "./authFormError";
import { passkeyErrorCode } from "./passkeyErrorCode";
import { SocialButtons } from "./SocialButtons";

type SignInPanelProps = {
  providers: readonly SocialProvider[];
  initialErrorCode: string | null;
};

export function SignInPanel({ providers, initialErrorCode }: SignInPanelProps) {
  const router = useRouter();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(
    initialErrorCode ? authFormError(initialErrorCode) : null,
  );

  const errorId = `${uid}-error`;

  // Autofill condicional: o navegador oferece as passkeys no campo de e-mail.
  // Só roda onde existe WebAuthn com mediação condicional (nunca no SSR nem no
  // ambiente de teste); cancelar ou falhar aqui é normal e fica em silêncio.
  useEffect(() => {
    let active = true;
    async function startAutofill() {
      try {
        const available =
          await globalThis.PublicKeyCredential?.isConditionalMediationAvailable?.();
        if (!available || !active) return;
        const result = await authClient.signIn.passkey({ autoFill: true });
        if (active && result?.data) {
          router.push("/");
          router.refresh();
        }
      } catch {
        // Sem suporte ou ceremony abortada: o login por e-mail segue disponível.
      }
    }
    void startAutofill();
    return () => {
      active = false;
    };
  }, [router]);

  function finishSignIn() {
    router.push("/");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError(authFormError(signInError.code));
        setPending(false);
        return;
      }
      finishSignIn();
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  async function handlePasskey() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: passkeyError } = await authClient.signIn.passkey();
      if (passkeyError) {
        setError(
          authFormError(
            passkeyErrorCode(errorCodeOf(passkeyError), "authenticate"),
          ),
        );
        setPending(false);
        return;
      }
      finishSignIn();
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  async function handleSocial(provider: SocialProvider) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: socialError } = await authClient.signIn.social({
        provider,
        requestSignUp: false,
        callbackURL: "/",
        errorCallbackURL: "/entrar",
      });
      if (socialError) {
        setError(authFormError(socialError.code));
        setPending(false);
      }
      // Sem erro, o navegador está indo para o provedor: mantém travado.
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  const emailError = error?.field === "email";

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Entrar no Closery
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={emailError ? true : undefined}>
              <FieldLabel htmlFor={`${uid}-email`}>E-mail</FieldLabel>
              <Input
                id={`${uid}-email`}
                name="email"
                type="email"
                autoComplete="username webauthn"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? errorId : undefined}
              />
              {emailError && (
                <FieldError id={errorId}>{error?.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor={`${uid}-password`}>Senha</FieldLabel>
              <Input
                id={`${uid}-password`}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            {error && !emailError && (
              <FieldError id={errorId}>{error.message}</FieldError>
            )}

            <Button type="submit" size="lg" disabled={pending}>
              Entrar
            </Button>
          </FieldGroup>
        </form>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={handlePasskey}
        >
          Entrar com passkey
        </Button>

        <SocialButtons
          providers={providers}
          onSelect={handleSocial}
          disabled={pending}
        />
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          O acesso é só por convite.
        </p>
      </CardFooter>
    </Card>
  );
}
