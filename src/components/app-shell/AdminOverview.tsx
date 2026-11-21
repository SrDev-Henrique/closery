import { requireAdmin } from "@/lib/auth/session";

export async function AdminOverview() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
      <p className="text-muted-foreground">
        Setores, turnos, itens, destinos e equipe chegam na próxima etapa.
      </p>
    </div>
  );
}
