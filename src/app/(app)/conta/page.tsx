import type { Metadata } from "next";
import { Suspense } from "react";
import { PasskeyManager } from "@/components/auth/PasskeyManager";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PrivacyLink } from "@/components/privacy/PrivacyLink";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Conta" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Conta</h1>
      <Suspense fallback={<AccountFallback />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

// A sessão é dado de requisição: só pode ser lida dentro do <Suspense>.
async function AccountContent() {
  const { name, email } = await requireUser();
  return (
    <>
      <div className="flex flex-col">
        <span className="text-base font-medium">{name}</span>
        <span className="text-sm text-muted-foreground">{email}</span>
      </div>
      <PasskeyManager />
      <SignOutButton />
      <PrivacyLink />
    </>
  );
}

function AccountFallback() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
