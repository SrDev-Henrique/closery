import {
  type InviteCounts,
  InviteTeamCard,
} from "@/components/app-shell/InviteTeamCard";
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import type { HomeHandovers as HomeHandoversData } from "@/features/handovers/home";
import type { HomeRequests } from "@/features/requests/types";
import { requestsHref } from "@/features/requests/urls";
import { avatarDataUri } from "@/lib/avatar";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";

// O `avatarDataUri` recusa semente vazia. Quem entregou só vem vazio se a
// linha da passagem escapar do check do banco (spec §6.4.1); aí a frase
// aparece sem avatar.
function avatarOf(userId: string | null): string | null {
  return userId === null || userId === "" ? null : avatarDataUri(userId);
}

// Os cartões do Início, depois do hero. Em coluna, na ordem: convite (primeiro
// acesso do admin), pendente (se houver) e, na linha de baixo, turno e
// solicitações. Esta linha é 1 coluna e vira `minmax(0,1.3fr) minmax(0,1fr)` a
// partir de 1040px de ÁREA ÚTIL (container query do `@container/main`, não a
// largura da janela). Os avatares nascem aqui, no servidor, com o id da pessoa;
// os cartões só desenham o data URI que recebem. O `data-slot="home-cards"` é o
// ponto de extensão que a Task 11 criou (e testa) no `HomeHandovers`.
export function HomeCards({
  home,
  requests,
  sectorParam,
  canManageCatalog,
  actorId,
  inviteCounts,
  firstAccess,
}: {
  home: HomeHandoversData;
  requests: HomeRequests;
  sectorParam: string | null;
  canManageCatalog: boolean;
  actorId: string;
  // Não nulo = mostrar "Convide sua equipe" (admin, sozinho, não dispensado).
  inviteCounts: InviteCounts | null;
  // Primeiro acesso do admin (mesmo depois de dispensar o convite).
  firstAccess: boolean;
}) {
  const savedAvatar =
    home.mine.kind === "continue" && home.mine.saved
      ? avatarDataUri(home.mine.saved.byId)
      : null;
  // Linha de entrega do meu turno: quem entregou e, na confirmada, quem
  // confirmou (a pilha do `MyShiftCard`).
  const deliveredAvatar =
    home.mine.kind === "delivered" || home.mine.kind === "confirmed"
      ? avatarOf(home.mine.deliveredById)
      : null;
  const confirmedAvatar =
    home.mine.kind === "confirmed" ? avatarOf(home.mine.confirmedById) : null;

  return (
    <div data-slot="home-cards" className="flex flex-col gap-4">
      {inviteCounts && (
        <InviteTeamCard
          counts={inviteCounts}
          avatarSrc={avatarDataUri(actorId)}
        />
      )}
      {home.pending && (
        <PendingHandoverCard
          pending={home.pending}
          avatarSrc={avatarDataUri(home.pending.deliveredById)}
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 @min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          sectorName={home.sector.name}
          sectorColor={home.sector.color}
          canManageCatalog={canManageCatalog}
          sectorParam={sectorParam}
          avatarSrc={savedAvatar}
          deliveredAvatarSrc={deliveredAvatar}
          confirmedAvatarSrc={confirmedAvatar}
        />
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
          avatarSrc={avatarDataUri(actorId)}
          firstAccess={firstAccess}
        />
      </div>
    </div>
  );
}
