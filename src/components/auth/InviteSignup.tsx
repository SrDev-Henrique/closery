"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { armInvite } from "@/app/(auth)/convite/[token]/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import type { SocialProvider } from "@/lib/auth/env";
import { type AuthFormError, authFormError } from "./authFormError";
import { SocialButtons } from "./SocialButtons";

type InviteSignupProps = {
  token: string;
  providers: readonly SocialProvider[];
  defaultName: string;
  initialErrorCode: string | null;
};

export function InviteSignup({
  token,
  providers,
  defaultName,
  initialErrorCode,
}: InviteSignupProps) {
  const router = useRouter();
  const uid = useId();
  // Estado controlado: o React 19 limpa formulários não controlados depois
  // de um submit e a pessoa perderia o que digitou quando o servidor recusa.
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(
    initialErrorCode ? authFormError(initialErrorCode) : null,
  );

  const errorId = `${uid}-error`;

  // Revalida o convite e grava o cookie antes de qualquer cadastro.
  async function arm(): Promise<boolean> {
    const armed = await armInvite(token);
    if (!armed.ok) {
      setError({ message: armed.message, field: null });
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (!(await arm())) {
        setPending(false);
        return;
      }
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (signUpError) {
        setError(authFormError(signUpError.code));
        setPending(false);
        return;
      }
      // Sucesso: o botão fica travado até a navegação terminar.
      router.push("/bem-vindo");
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
      if (!(await arm())) {
        setPending(false);
        return;
      }
      const { error: socialError } = await authClient.signIn.social({
        provider,
        requestSignUp: true,
        callbackURL: "/",
        newUserCallbackURL: "/bem-vindo",
        errorCallbackURL: `/convite/${token}`,
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

  const fieldError = (field: "email" | "password") =>
    error?.field === field ? error : null;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>Nome</FieldLabel>
            <Input
              id={`${uid}-name`}
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field data-invalid={fieldError("email") ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-email`}>E-mail</FieldLabel>
            <Input
              id={`${uid}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldError("email") ? true : undefined}
              aria-describedby={fieldError("email") ? errorId : undefined}
            />
            {fieldError("email") && (
              <FieldError id={errorId}>{error?.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={fieldError("password") ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-password`}>Senha</FieldLabel>
            <Input
              id={`${uid}-password`}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={fieldError("password") ? true : undefined}
              aria-describedby={fieldError("password") ? errorId : undefined}
            />
            {fieldError("password") && (
              <FieldError id={errorId}>{error?.message}</FieldError>
            )}
          </Field>

          {error && error.field === null && (
            <FieldError id={errorId}>{error.message}</FieldError>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            Criar conta
          </Button>
        </FieldGroup>
      </form>

      <SocialButtons
        providers={providers}
        onSelect={handleSocial}
        disabled={pending}
      />
    </div>
  );
}
