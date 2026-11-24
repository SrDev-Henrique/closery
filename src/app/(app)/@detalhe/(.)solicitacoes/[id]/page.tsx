import { Suspense } from "react";

import { RequestDetail } from "@/components/solicitacoes/RequestDetail";
import { RequestDetailSkeleton } from "@/components/solicitacoes/RequestDetailSkeleton";
import { RequestSheet } from "@/components/solicitacoes/RequestSheet";
import { COMMENTS_PAGE_SIZE } from "@/features/requests/limits";

// Detalhe rápido: a rota interceptada abre o mesmo detalhe num Sheet por cima da
// tela atual. Sem `metadata` (o título é o da página de baixo).
export default function InterceptedRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RequestSheet>
      <Suspense fallback={<RequestDetailSkeleton />}>
        <Content params={params} />
      </Suspense>
    </RequestSheet>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequestDetail id={id} variant="sheet" commentsLimit={COMMENTS_PAGE_SIZE} />
  );
}
