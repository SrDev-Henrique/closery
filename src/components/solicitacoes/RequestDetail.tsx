import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadOnlySectorNotice } from "@/components/passagens/ReadOnlySectorNotice";
import { buttonVariants } from "@/components/ui/button";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { db } from "@/db";
import { idSchema } from "@/features/admin/schemas";
import { isAdmin } from "@/features/authz/authz";
import { formatQuantity } from "@/features/handovers/quantity";
import {
  formatDateAtTimeBR,
  formatDateBR,
} from "@/features/handovers/saoPaulo";
import { handoverHref } from "@/features/handovers/urls";
import { getRequestDetail } from "@/features/requests/detail";
import {
  COMMENTS_MAX_LIMIT,
  COMMENTS_PAGE_SIZE,
} from "@/features/requests/limits";
import { destinationLabel } from "@/features/requests/text";
import { requestHref, requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

import { RequestComments } from "./RequestComments";
import { RequestStatusActions } from "./RequestStatusActions";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { RequestTimeline } from "./RequestTimeline";
import { StaleBadge } from "./StaleBadge";

type RequestDetailProps = {
  id: string;
  variant: "page" | "sheet";
  commentsLimit: number;
};

// Mesmo componente servidor na página completa e no Sheet (rota interceptada).
export async function RequestDetail({
  id,
  variant,
  commentsLimit,
}: RequestDetailProps) {
  const actor = await requireUser();
  const result = idSchema.safeParse(id).success
    ? await getRequestDetail(db, actor, { id, commentsLimit }, new Date())
    : null;

  if (result === null || !result.ok) {
    // No Sheet o estado fica dentro dele: um notFound() no slot derrubaria a tela.
    if (variant === "page") notFound();
    return (
      <div className="flex flex-col gap-1">
        <SheetTitle>Solicitação não encontrada.</SheetTitle>
        <SheetDescription>Ela não existe ou é de outro setor.</SheetDescription>
      </div>
    );
  }

  const { detail } = result;
  const { capabilities } = detail;
  const admin = isAdmin(actor);
  const title = `Solicitação para ${detail.destinationName}`;
  const Section = variant === "page" ? "h2" : "h3";
  const headingLevel = variant === "page" ? 2 : 3;
  const earlierHref =
    detail.comments.hasEarlier && detail.comments.limit < COMMENTS_MAX_LIMIT
      ? requestHref(detail.id, {
          comments: detail.comments.limit + COMMENTS_PAGE_SIZE,
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {variant === "page" ? (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        ) : (
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {title}
          </SheetTitle>
        )}
        <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
        {variant === "sheet" ? (
          <a
            href={requestHref(detail.id)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-fit",
            )}
          >
            <SquareArrowOutUpRight aria-hidden="true" />
            Abrir página completa
          </a>
        ) : (
          <Link
            href={requestsHref(admin ? detail.sectorId : null)}
            className="w-fit text-sm underline underline-offset-4 max-md:inline-flex max-md:min-h-11 max-md:items-center"
          >
            Ver todas as solicitações
          </Link>
        )}
      </header>

      {!detail.sectorActive && <ReadOnlySectorNotice />}

      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={detail.status} />
          {detail.stale && <StaleBadge days={detail.daysInStatus} />}
        </dd>
        {admin && (
          <>
            <dt className="text-muted-foreground">Setor</dt>
            <dd>{detail.sectorName}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Destino</dt>
        <dd>
          {destinationLabel(detail.destinationName, detail.destinationIsOther)}
        </dd>
        <dt className="text-muted-foreground">Criada por</dt>
        <dd>
          {detail.createdByName} em {formatDateAtTimeBR(detail.createdAt)}
        </dd>
        {detail.origin && (
          <>
            <dt className="text-muted-foreground">Origem</dt>
            <dd>
              <Link
                href={handoverHref(detail.origin.handoverId)}
                className="underline underline-offset-4"
              >
                Criada na passagem de {detail.origin.shiftName} de{" "}
                {formatDateBR(detail.origin.operationalDate)}
              </Link>
            </dd>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-2">
        <Section className="text-base font-medium">Itens</Section>
        {detail.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {detail.items.map((line) => (
              <li
                key={line.itemId}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>{line.name}</span>
                <span className="tabular-nums">
                  {formatQuantity(line.quantity)} {line.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {capabilities.canMove && (
        <section className="flex flex-col gap-2">
          <Section className="text-base font-medium">Mudar status</Section>
          <RequestStatusActions
            requestId={detail.id}
            status={detail.status}
            description={detail.description}
            canCancel={capabilities.canCancel}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <Section className="text-base font-medium">Linha do tempo</Section>
        <RequestTimeline entries={detail.timeline} />
      </section>

      <RequestComments
        requestId={detail.id}
        comments={detail.comments}
        canComment={capabilities.canComment}
        earlierHref={earlierHref}
        headingLevel={headingLevel}
      />
    </div>
  );
}
