import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestDetail } from "@/components/solicitacoes/RequestDetail";
import { RequestDetailSkeleton } from "@/components/solicitacoes/RequestDetailSkeleton";
import { parseCommentsLimit } from "@/features/requests/urls";

export const metadata: Metadata = { title: "Solicitação" };

// params e searchParams são dinâmicos: só dentro do <Suspense> (Cache Components).
export default function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<RequestDetailSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <RequestDetail
      id={id}
      variant="page"
      commentsLimit={parseCommentsLimit(query.comentarios)}
    />
  );
}
