import { cn } from "cn";
import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { staleCountLabel } from "@/features/requests/text";
import type { HomeRequests } from "@/features/requests/types";

import { OpenRequestItem } from "./OpenRequestItem";

// Cartão "Solicitações" do Início: o contador grande de abertas, o selo de
// paradas e as paradas há mais tempo (até 5) para quem quer agir já. Vazio:
// o avatar de quem está logado e a frase; no primeiro acesso do admin, mais
// uma linha de apoio. O contador cai de 76 para 60px quando o cartão divide a
// linha com o de turno e a área útil é menor que 1240px, e para 52px no celular.
export function RequestsHomeCard({
  home,
  allHref,
  avatarSrc,
  firstAccess = false,
}: {
  home: HomeRequests;
  allHref: string;
  avatarSrc: string;
  firstAccess?: boolean;
}) {
  return (
    <Card variant="feature" className="gap-5">
      <h2 className="font-heading text-lg leading-[normal] font-bold">
        Solicitações
      </h2>

      {home.openCount === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-4 py-3">
          <UserAvatar src={avatarSrc} size={84} tilt={-5} />
          <p className="font-heading text-[28px] leading-[1.1] font-black tracking-[-0.02em]">
            Nenhuma solicitação aberta.
          </p>
          {firstAccess && (
            <p className="-mt-1.5 text-[15px] leading-normal text-pretty text-muted-foreground">
              Os pedidos da equipe aparecem aqui assim que alguém registrar o
              primeiro.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-3.5">
          <span className="font-heading text-[76px] leading-[.85] font-black tracking-[-0.04em] tabular-nums max-md:text-[52px] @min-[1040px]/main:@max-[1239px]/main:text-[60px]">
            {home.openCount}
          </span>
          <div className="flex flex-col items-start gap-1.5 pb-0.5">
            <span className="font-heading text-lg leading-none font-bold">
              {home.openCount === 1 ? "aberta" : "abertas"}
            </span>
            {home.staleCount > 0 && (
              // Protótipo: 12.5px e gap de 5px; ícone de 12px com traço 2.4.
              <Badge
                variant="warning"
                size="md"
                className="gap-[5px] text-[12.5px] leading-[normal]"
              >
                <TriangleAlert aria-hidden="true" strokeWidth={2.4} />
                {staleCountLabel(home.staleCount)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {home.stale.length > 0 && (
        <div className="flex flex-col">
          <h3 className="mb-1 font-mono text-xs leading-none font-medium tracking-[.06em] text-muted-foreground uppercase">
            Paradas há mais tempo
          </h3>
          <ul className="flex flex-col">
            {home.stale.map((request) => (
              // Selos só com texto, como no protótipo (decisão do dono, D1).
              <OpenRequestItem
                key={request.id}
                request={request}
                badgeIcons={false}
              />
            ))}
          </ul>
        </div>
      )}

      {/* 20px de padding (protótipo): o `cn` troca o `px-[22px]` do `pill`. */}
      <Link
        href={allHref}
        className={cn(
          buttonVariants({ variant: "default", size: "pill" }),
          "mt-auto w-fit px-5",
        )}
      >
        Ver solicitações
        <ArrowRight aria-hidden="true" strokeWidth={2.2} />
      </Link>
    </Card>
  );
}
