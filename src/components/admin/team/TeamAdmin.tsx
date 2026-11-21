import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { listPeople, type PersonRow } from "@/features/admin/people";
import { listActiveSectors } from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";
import { PersonRowActions } from "./PersonRowActions";
import { ROLE_LABELS } from "./roleOptions";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sectorText(person: PersonRow): string | null {
  if (!person.sectorName) return null;
  return person.sectorActive === false
    ? `${person.sectorName} (inativo)`
    : person.sectorName;
}

export async function TeamAdmin({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const [people, sectors] = await Promise.all([
    listPeople(db, { page: parsePage(params.pagina) }),
    listActiveSectors(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Equipe"
        description="Pessoas, papéis e convites."
        backHref="/admin"
      />

      <section className="flex flex-col gap-3" aria-labelledby="people-title">
        <h2 id="people-title" className="text-base font-medium">
          Pessoas
        </h2>
        {people.rows.length === 0 ? (
          <EmptyState title="Nenhuma pessoa ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {people.rows.map((person) => {
              const isSelf = person.id === actor.userId;
              const sector = sectorText(person);
              return (
                <AdminListRow
                  key={person.id}
                  title={person.name}
                  inactive={!person.active}
                  subtitle={
                    <div className="flex flex-col">
                      <span>{person.email}</span>
                      {sector && <span>{sector}</span>}
                    </div>
                  }
                  badges={
                    <>
                      <Badge variant="outline">
                        {ROLE_LABELS[person.role]}
                      </Badge>
                      {isSelf && <Badge>Você</Badge>}
                    </>
                  }
                  notes={
                    isSelf ? (
                      <p className="text-sm text-muted-foreground">
                        Peça a outro administrador para mudar a sua conta.
                      </p>
                    ) : undefined
                  }
                  actions={
                    isSelf ? undefined : (
                      <PersonRowActions person={person} sectors={sectors} />
                    )
                  }
                />
              );
            })}
          </ul>
        )}
        <Pagination
          page={people.page}
          pageCount={people.pageCount}
          pathname="/admin/equipe"
          params={{ pagina: single(params.pagina) }}
        />
      </section>
    </div>
  );
}
