import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { InviteSignup } from "@/components/auth/InviteSignup";
import { InviteUnavailable } from "@/components/auth/InviteUnavailable";
import { PrivacyLink } from "@/components/privacy/PrivacyLink";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { inviteSentence } from "@/features/invites/inviteSentence";
import { authEnv } from "@/lib/auth";
import { enabledSocialProviders } from "@/lib/auth/env";

export const metadata: Metadata = { title: "Convite" };

type InvitePageProps = PageProps<"/convite/[token]">;

// Page não lê params/searchParams: eles são dados de requisição e só podem
// ser aguardados dentro do <Suspense> (Cache Components).
export default function Page(props: InvitePageProps) {
  return (
    <Suspense fallback={<InviteFallback />}>
      <InviteContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function InviteContent({
  params,
  searchParams,
}: {
  params: InvitePageProps["params"];
  searchParams: InvitePageProps["searchParams"];
}) {
  const { token } = await params;
  const query = await searchParams;
  // new Date() só depois de marcar a renderização como dinâmica (Cache
  // Components). Aguardar params/searchParams não basta: sem isto o servidor
  // registra "encountered the unstable value new Date()" a cada requisição.
  await connection();
  const details = await findInviteByToken(db, token, new Date());

  if (!details) return <InviteUnavailable reason="not_found" />;
  if (details.state !== "valid") {
    return <InviteUnavailable reason={details.state} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Você foi convidado
        </CardTitle>
        <CardDescription>{inviteSentence(details)}</CardDescription>
      </CardHeader>
      <CardContent>
        <InviteSignup
          token={token}
          providers={enabledSocialProviders(authEnv)}
          defaultName={details.inviteeLabel ?? ""}
          initialErrorCode={
            typeof query.error === "string" ? query.error : null
          }
        />
      </CardContent>
      <CardFooter>
        <PrivacyLink />
      </CardFooter>
    </Card>
  );
}

function InviteFallback() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}
