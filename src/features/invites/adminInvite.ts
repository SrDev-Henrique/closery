import type { Db } from "@/db/types";

import { createInvite } from "./inviteQueries";
import { buildInviteUrl, isHttpUrl } from "./inviteUrl";

export const ADMIN_INVITE_LABEL_MAX_LENGTH = 80;

const USAGE = 'Uso: bun run admin:invite [--label "Nome de referência"]';

export function parseAdminInviteArgs(argv: string[]): {
  label: string | null;
} {
  let label: string | null = null;
  let labelSeen = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    let value: string;

    if (arg === "--label") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error(`Falta o valor de --label. ${USAGE}`);
      }
      value = next;
      i++;
    } else if (arg.startsWith("--label=")) {
      value = arg.slice("--label=".length);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}. ${USAGE}`);
    }

    if (labelSeen) {
      throw new Error(`--label foi informado mais de uma vez. ${USAGE}`);
    }
    labelSeen = true;

    const trimmed = value.trim();
    if (trimmed.length > ADMIN_INVITE_LABEL_MAX_LENGTH) {
      throw new Error(
        `--label aceita no máximo ${ADMIN_INVITE_LABEL_MAX_LENGTH} caracteres.`,
      );
    }
    label = trimmed === "" ? null : trimmed;
  }

  return { label };
}

export async function createAdminInvite(
  db: Db,
  input: { label: string | null; baseURL: string; now: Date },
): Promise<{ url: string; expiresAt: Date }> {
  // Valida a URL antes de gravar: senão o convite nasceria sem link imprimível.
  if (!isHttpUrl(input.baseURL)) {
    throw new Error(
      `BETTER_AUTH_URL não é uma URL absoluta (ex.: http://localhost:3000): "${input.baseURL}".`,
    );
  }

  const { token, expiresAt } = await createInvite(db, {
    role: "admin",
    sectorId: null,
    inviteeLabel: input.label,
    invitedBy: null,
    now: input.now,
  });

  return { url: buildInviteUrl(input.baseURL, token), expiresAt };
}

export function formatAdminInviteOutput(result: {
  url: string;
  expiresAt: Date;
}): string {
  const expires = result.expiresAt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

  return [
    "Convite de administrador criado.",
    "",
    `Link: ${result.url}`,
    `Válido até: ${expires} (horário de Brasília)`,
    "",
    "O link vale para uma conta só e não é exibido de novo: copie agora.",
  ].join("\n");
}
