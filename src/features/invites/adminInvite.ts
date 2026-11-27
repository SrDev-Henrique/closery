import type { Db } from "@/db/types";

import { createInvite } from "./inviteQueries";
import { buildInviteUrl, isHttpUrl } from "./inviteUrl";

export const ADMIN_INVITE_LABEL_MAX_LENGTH = 80;

const USAGE =
  'Uso: bun run admin:invite --confirmar-host=<host do banco> [--label "Nome de referência"]';

const CONFIRM_FLAG = "--confirmar-host";

export type AdminInviteArgs = {
  label: string | null;
  confirmHost: string | null;
};

// Lê `--flag valor` ou `--flag=valor`; devolve o valor e quantos argumentos
// consumiu (null se o argumento não é essa flag).
function readFlag(
  argv: string[],
  i: number,
  flag: string,
): { value: string; consumed: number } | null {
  const arg = argv[i] ?? "";
  if (arg === flag) {
    const next = argv[i + 1];
    if (next === undefined) {
      throw new Error(`Falta o valor de ${flag}. ${USAGE}`);
    }
    return { value: next, consumed: 2 };
  }
  if (arg.startsWith(`${flag}=`)) {
    return { value: arg.slice(flag.length + 1), consumed: 1 };
  }
  return null;
}

export function parseAdminInviteArgs(argv: string[]): AdminInviteArgs {
  let label: string | null = null;
  let labelSeen = false;
  let confirmHost: string | null = null;
  let confirmSeen = false;

  for (let i = 0; i < argv.length; ) {
    const asLabel = readFlag(argv, i, "--label");
    if (asLabel) {
      if (labelSeen) {
        throw new Error(`--label foi informado mais de uma vez. ${USAGE}`);
      }
      labelSeen = true;
      const trimmed = asLabel.value.trim();
      if (trimmed.length > ADMIN_INVITE_LABEL_MAX_LENGTH) {
        throw new Error(
          `--label aceita no máximo ${ADMIN_INVITE_LABEL_MAX_LENGTH} caracteres.`,
        );
      }
      label = trimmed === "" ? null : trimmed;
      i += asLabel.consumed;
      continue;
    }

    const asConfirm = readFlag(argv, i, CONFIRM_FLAG);
    if (asConfirm) {
      if (confirmSeen) {
        throw new Error(
          `${CONFIRM_FLAG} foi informado mais de uma vez. ${USAGE}`,
        );
      }
      confirmSeen = true;
      const trimmed = asConfirm.value.trim();
      confirmHost = trimmed === "" ? null : trimmed;
      i += asConfirm.consumed;
      continue;
    }

    throw new Error(`Argumento desconhecido: ${argv[i]}. ${USAGE}`);
  }

  return { label, confirmHost };
}

// Trava de host: o convite de administrador só é criado se quem roda disse,
// por extenso, em qual banco está escrevendo. Evita criar o admin no banco
// errado (dev x produção). O host vem do banco que o script vai usar (o do
// pooler, se houver: `-pooler` faz parte do host).
export function assertHostConfirmed(
  databaseHost: string,
  confirmHost: string | null,
): void {
  if (confirmHost === null) {
    throw new Error(
      `Confirme o banco de destino: rode de novo com ${CONFIRM_FLAG}=${databaseHost}`,
    );
  }
  if (confirmHost.toLowerCase() !== databaseHost.toLowerCase()) {
    throw new Error(
      `${CONFIRM_FLAG} não confere com o banco de destino (${databaseHost}). Nada foi criado.`,
    );
  }
}

export function formatAdminInviteTarget(input: {
  databaseHost: string;
  baseURL: string;
}): string {
  return [
    `Banco de destino: ${input.databaseHost}`,
    `BETTER_AUTH_URL:  ${input.baseURL}`,
  ].join("\n");
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

const SAFE_ERROR_CODE = /^[A-Za-z0-9_]{1,32}$/;

function safeCodeOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const code: unknown = Reflect.get(value, "code");
  return typeof code === "string" && SAFE_ERROR_CODE.test(code) ? code : null;
}

// Só os erros do próprio script (Error puro: argumento, host, URL) mostram a
// mensagem. Qualquer outro erro (o DrizzleQueryError traz o SQL e os params,
// com o hash do token) vira uma linha sem conteúdo. Não importa
// logServerError: na Tarefa 6 aquele módulo carrega o @sentry/nextjs.
export function formatAdminInviteError(error: unknown): string {
  if (
    error instanceof Error &&
    Object.getPrototypeOf(error) === Error.prototype
  ) {
    return `Erro: ${error.message}`;
  }

  const name = error instanceof Error ? error.constructor.name : "NonError";
  const code =
    safeCodeOf(error) ??
    safeCodeOf(error instanceof Error ? error.cause : null);
  const detail = code === null ? name : `${name}, código ${code}`;

  return `Erro: falha inesperada ao gravar o convite (${detail}). Confira no banco se o convite foi criado antes de rodar de novo.`;
}
