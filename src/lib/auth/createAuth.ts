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

import type { AuthEnv } from "./env";
import { INVITE_COOKIE } from "./inviteCookie";

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
      // Sem `sendResetPassword`: ainda não há e-mail transacional (P8). O
      // endpoint responde RESET_PASSWORD_DISABLED e a tela não oferece o link.
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

    // Login social nunca vincula sozinho a uma conta existente: o e-mail dos
    // convidados é marcado como verificado pelo convite, então vincular pelo
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
            return {
              data: {
                ...newUser,
                role: consumed.role,
                sectorId: consumed.sectorId,
                emailVerified: true,
              },
            };
          },
          after: async (createdUser, ctx) => {
            const token = ctx?.getCookie(INVITE_COOKIE);
            if (!token) return;
            await recordInviteUser(db, token, createdUser.id);
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
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
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
