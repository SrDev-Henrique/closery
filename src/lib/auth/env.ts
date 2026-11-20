import { z } from "zod";

export type SocialProvider = "google" | "facebook";

export type AuthEnv = {
  secret: string;
  baseURL: string;
  google: { clientId: string; clientSecret: string } | null;
  facebook: { clientId: string; clientSecret: string } | null;
};

type RawEnv = Record<string, string | undefined>;

// Variável vazia ("FOO=") é o mesmo que ausente.
const blankAsMissing = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(blankAsMissing, z.string().optional());

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.preprocess(
    blankAsMissing,
    z
      .string({ error: "ausente" })
      .min(32, "precisa ter pelo menos 32 caracteres"),
  ),
  BETTER_AUTH_URL: z.preprocess(
    blankAsMissing,
    z.string({ error: "ausente" }).pipe(
      z.url({
        protocol: /^https?$/,
        error:
          "precisa ser uma URL absoluta http(s), ex.: http://localhost:3000",
      }),
    ),
  ),
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  FACEBOOK_CLIENT_ID: optionalText,
  FACEBOOK_CLIENT_SECRET: optionalText,
});

function pair(
  idName: string,
  secretName: string,
  id: string | undefined,
  secret: string | undefined,
  problems: string[],
): { clientId: string; clientSecret: string } | null {
  if (id && secret) return { clientId: id, clientSecret: secret };
  if (id && !secret)
    problems.push(`${secretName}: ausente (${idName} foi informado)`);
  if (!id && secret)
    problems.push(`${idName}: ausente (${secretName} foi informado)`);
  return null;
}

// Lança Error em pt-BR listando tudo que está errado. Nunca inclui o valor das
// variáveis na mensagem (o secret não pode vazar para log).
export function parseAuthEnv(env: RawEnv): AuthEnv {
  const parsed = authEnvSchema.safeParse(env);
  const problems: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? "ambiente");
      problems.push(`${name}: ${issue.message}`);
    }
  }

  const data = parsed.success ? parsed.data : null;
  const google = pair(
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    data?.GOOGLE_CLIENT_ID,
    data?.GOOGLE_CLIENT_SECRET,
    problems,
  );
  const facebook = pair(
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
    data?.FACEBOOK_CLIENT_ID,
    data?.FACEBOOK_CLIENT_SECRET,
    problems,
  );

  if (!data || problems.length > 0) {
    throw new Error(
      `Variáveis de ambiente de autenticação inválidas:\n${problems
        .map((problem) => `- ${problem}`)
        .join("\n")}\nVeja .env.example.`,
    );
  }

  return {
    secret: data.BETTER_AUTH_SECRET,
    baseURL: new URL(data.BETTER_AUTH_URL).origin,
    google,
    facebook,
  };
}

export function enabledSocialProviders(env: AuthEnv): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (env.google) providers.push("google");
  if (env.facebook) providers.push("facebook");
  return providers;
}
