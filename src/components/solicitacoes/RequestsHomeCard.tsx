import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openCountLabel, staleCountLabel } from "@/features/requests/text";
import type { HomeRequests } from "@/features/requests/types";

import { OpenRequestItem } from "./OpenRequestItem";

// Cartão "Solicitações" do Início: quantas abertas e quantas paradas, com as
// paradas há mais tempo logo abaixo (até 5) para quem quer agir já.
export function RequestsHomeCard({
  home,
  allHref,
}: {
  home: HomeRequests;
  allHref: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Solicitações</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {home.openCount === 0 ? (
          <p className="text-muted-foreground">Nenhuma solicitação aberta.</p>
        ) : (
          <p className="font-medium tabular-nums">
            {`${openCountLabel(home.openCount)} · ${staleCountLabel(home.staleCount)}`}
          </p>
        )}
        {home.stale.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Paradas há mais tempo
            </h3>
            <ul className="flex flex-col divide-y">
              {home.stale.map((request) => (
                <OpenRequestItem key={request.id} request={request} />
              ))}
            </ul>
          </div>
        )}
        <Link
          href={allHref}
          className={`${buttonVariants({ variant: "outline" })} w-fit`}
        >
          Ver solicitações
        </Link>
      </CardContent>
    </Card>
  );
}
