import type { MetadataRoute } from "next";

// Piloto interno: nenhum buscador indexa nada (par do X-Robots-Tag e do
// metadata.robots do layout raiz).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
