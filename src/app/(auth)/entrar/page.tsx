import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authEnv } from "@/lib/auth";
import { enabledSocialProviders } from "@/lib/auth/env";
import { getAuthz } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

// Page não lê sessão nem searchParams: ambos são dados de requisição e só
// podem ser aguardados dentro do <Suspense> (Cache Components).
export default function Page(props: PageProps<"/entrar">) {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SignInContent({
  searchParams,
}: {
  searchParams: PageProps<"/entrar">["searchParams"];
}) {
  // Quem já está logado não precisa da tela de entrada.
  if (await getAuthz()) redirect("/");

  const query = await searchParams;
  return (
    <SignInPanel
      providers={enabledSocialProviders(authEnv)}
      initialErrorCode={typeof query.error === "string" ? query.error : null}
    />
  );
}

function SignInFallback() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}
