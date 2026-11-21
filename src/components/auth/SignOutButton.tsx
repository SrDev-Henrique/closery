"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { authFormError } from "./authFormError";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        setError(authFormError(null).message);
        setPending(false);
        return;
      }
      router.push("/entrar");
      router.refresh();
    } catch {
      setError(authFormError(null).message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={handleSignOut}
      >
        Sair
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
