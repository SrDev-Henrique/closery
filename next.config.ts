import type { NextConfig } from "next";

// Cabeçalhos de segurança de todas as rotas. Sem CSP de scripts: um CSP com
// nonce obriga renderização dinâmica em toda página e desliga o que o
// cacheComponents/PPR entrega (content-security-policy.md). Aqui só
// `frame-ancestors`, que não precisa de nonce. O HSTS a Vercel já envia
// (max-age=63072000; includeSubDomains; preload) em *.vercel.app.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Anti-clickjacking: CSP moderno + X-Frame-Options para navegador antigo.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Passkeys (WebAuthn) usam publickey-credentials-get/create, que por padrão
  // valem para a própria origem: por isso ficam fora desta lista.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Piloto interno: nada de buscador (o robots.txt é a outra metade).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// Tokens vão na URL: não podem vazar no Referer. Vem DEPOIS da regra global,
// que ela sobrescreve (mesma chave, regra posterior vence).
const noReferrer = [{ key: "Referrer-Policy", value: "no-referrer" }];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/convite/:path*", headers: noReferrer },
      { source: "/redefinir-senha/:path*", headers: noReferrer },
    ];
  },
};

export default nextConfig;
