import type { DBFieldAttribute } from "@better-auth/core/db";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import {
  consumeInvite,
  recordInviteUser,
} from "@/features/invites/inviteQueries";
import { logServerError } from "@/lib/logServerError";
import type { Role } from "@/lib/roles";

import type { AuthEnv } from "./env";
import { INVITE_COOKIE, inviteCookieOptions } from "./inviteCookie";

// O identificador que o /reset-password do Better Auth monta (`reset-password:<token>`).
// A configuração `verification.storeIdentifier` usa o mesmo prefixo para guardar só o hash.
export const RESET_PASSWORD_PREFIX = "reset-password:";

// Também usado pelo teste guarda de schema (schemaGuard.test.ts).
export const AUTH_USER_ADDITIONAL_FIELDS = {
  role: {
    type: ["admin", "operator"],
    required: true,
    defaultValue: "operator",
    input: false,
  },
  sectorId: { type: "string", required: false, input: false },
  deactivatedAt: { type: "date", required: false, input: false },
} satisfies Record<string, DBFieldAttribute>;

// O que o portão do convite grava no usuário novo: papel e setor vêm sempre do
// convite. `emailVerified` fica como o método de cadastro trouxe (false no
// e-mail e senha; o valor do provedor no login social): o convite não é
// atrelado a um endereço, então não serve de prova de que o e-mail é da pessoa.
export function inviteSignupData<T extends object>(
  newUser: T,
  grant: { role: Role; sectorId: string | null },
): T & { role: Role; sectorId: string | null } {
  return { ...newUser, role: grant.role, sectorId: grant.sectorId };
}

function inviteOnlyError(): APIError {
  return new APIError("FORBIDDEN", {
    message: "O cadastro é só por convite.",
    code: "SIGNUP_INVITE_ONLY",
  });
}

function accountDeactivatedError(): APIError {
  return new APIError("FORBIDDEN", {
    message: "Esta conta foi desativada.",
    code: "ACCOUNT_DEACTIVATED",
  });
}

// O tipo de retorno é inferido de propósito: `inferAdditionalFields<Auth>()` no
// cliente precisa do tipo exato (campos extras e plugin), que `ReturnType<typeof
// betterAuth>` apagaria.
export function createAuth(db: Db, env: AuthEnv) {
  const baseURL = env.baseURL;

  return betterAuth({
    appName: "Closery",
    secret: env.secret,
    baseURL,
    trustedOrigins: [baseURL],

    // Sem `transaction` (padrão: desligado). Ligado, o hook do convite consulta
    // fora da transação do adapter e o PGlite (uma conexão) travaria.
    database: drizzleAdapter(db, { provider: "pg", schema }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Sem `sendResetPassword` (sem e-mail transacional, P8): o endpoint de
      // pedido responde RESET_PASSWORD_DISABLED. O link nasce no admin
      // (features/admin/passwordReset.ts) e só POST /reset-password o consome.
      // Redefinir a senha derruba todas as sessões da pessoa.
      revokeSessionsOnPasswordReset: true,
    },

    // O token de redefinição fica no banco só como hash: vazamento do banco ou
    // um log "Failed query ... params" nunca expõe o token. O resto (desafio de
    // passkey, estado de OAuth) segue em texto puro, como o padrão.
    verification: {
      storeIdentifier: {
        default: "plain",
        overrides: { [RESET_PASSWORD_PREFIX]: "hashed" },
      },
    },

    // Por trás da Vercel o x-forwarded-for chega sobrescrito com o IP do
    // cliente (um valor só, que o Better Auth aceita). Só ele: x-real-ip e
    // x-vercel-forwarded-for seriam forjáveis fora da Vercel. Explícito para o
    // rate limit nunca cair no balde global por rota (P22).
    advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },

    // O logger padrão imprime o erro cru, e o erro do Drizzle carrega o SQL e os
    // parâmetros (token de sessão, IP, e-mail ou hash). Só o nível `error` e o
    // aviso de IP desconhecido passam, e passam por logServerError.
    logger: {
      log: (level, message, ...args) => {
        if (level === "error") {
          logServerError(
            args.find((arg) => arg instanceof Error) ?? null,
            "better-auth",
          );
        } else if (
          message.startsWith("Rate limiting could not determine a client IP")
        ) {
          logServerError(null, "better-auth:ip-desconhecido");
        }
      },
    },

    socialProviders: {
      ...(env.google
        ? {
            google: {
              clientId: env.google.clientId,
              clientSecret: env.google.clientSecret,
              disableImplicitSignUp: true,
            },
          }
        : {}),
      ...(env.facebook
        ? {
            facebook: {
              clientId: env.facebook.clientId,
              clientSecret: env.facebook.clientSecret,
              disableImplicitSignUp: true,
            },
          }
        : {}),
    },

    // Login social nunca vincula sozinho a uma conta existente: o e-mail de
    // quem cadastrou por e-mail e senha não é verificado, então vincular pelo
    // e-mail abriria tomada de conta. Quem tem conta entra "como da primeira
    // vez" (erro account_not_linked).
    account: { accountLinking: { disableImplicitLinking: true } },

    user: { additionalFields: AUTH_USER_ADDITIONAL_FIELDS },

    // Sem `session.cookieCache`: desativar uma pessoa ou mudar papel/setor vale
    // na próxima requisição (spec §4.1); a sessão é lida fresca do banco.
    // Sem o plugin `nextCookies()`: cadastro e login passam pelo `authClient`
    // (HTTP, onde o rate limit atua), então nenhum `auth.api.sign*` roda em
    // Server Action e não há cookie a repassar ao `cookies()` do Next (T7).

    databaseHooks: {
      user: {
        create: {
          // Portão único do cadastro, qualquer que seja o método (e-mail,
          // Google, Facebook). Consome o convite do cookie de forma atômica.
          before: async (newUser, ctx) => {
            // Fora de uma requisição não há cookie: recusa (fail-closed).
            if (!ctx) throw inviteOnlyError();
            const token = ctx.getCookie(INVITE_COOKIE);
            if (!token) throw inviteOnlyError();
            const consumed = await consumeInvite(db, token, new Date());
            if (!consumed) throw inviteOnlyError();
            return { data: inviteSignupData(newUser, consumed) };
          },
          after: async (createdUser, ctx) => {
            const token = ctx?.getCookie(INVITE_COOKIE);
            if (!token) return;
            await recordInviteUser(db, token, createdUser.id);
            // O convite já foi gasto: o cookie não tem mais serventia (P16).
            ctx?.setCookie(INVITE_COOKIE, "", {
              ...inviteCookieOptions(process.env.NODE_ENV === "production"),
              maxAge: 0,
            });
          },
        },
      },
      session: {
        create: {
          // Vale para e-mail e senha, OAuth e passkey: todo caminho que abre
          // sessão passa por aqui.
          before: async (newSession) => {
            const [row] = await db
              .select({ deactivatedAt: schema.user.deactivatedAt })
              .from(schema.user)
              .where(eq(schema.user.id, newSession.userId))
              .limit(1);
            if (row?.deactivatedAt) throw accountDeactivatedError();
          },
        },
      },
    },

    // Em serverless, `memory` é por instância e não limita nada: usa a tabela
    // rate_limit. O limiter só atua no router HTTP (/api/auth/*).
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      storage: "database",
      window: 10,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 30 },
        "/sign-up/email": { window: 60, max: 10 },
      },
    },

    plugins: [
      passkey({
        rpID: new URL(baseURL).hostname,
        rpName: "Closery",
        origin: baseURL,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
