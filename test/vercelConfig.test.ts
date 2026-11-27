import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda da configuração de produção: lê os próprios arquivos do repositório
// (caminho relativo à raiz, como o pendenciasDoc.test.ts).
function readJson(file: string) {
  return JSON.parse(readFileSync(file, "utf8"));
}

const vercel = readJson("vercel.json");
const pkg = readJson("package.json");

describe("vercel.json", () => {
  it("roda as funções em São Paulo (gru1), perto do Neon em sa-east-1", () => {
    expect(vercel.regions).toEqual(["gru1"]);
  });

  it("instala com o Bun do packageManager e lockfile congelado", () => {
    const bunVersion = String(pkg.packageManager).replace("bun@", "");
    expect(vercel.installCommand).toBe(
      `bunx bun@${bunVersion} install --frozen-lockfile`,
    );
  });

  it("builda com o script do projeto", () => {
    expect(vercel.buildCommand).toBe("bun run build");
  });

  it("só a main faz deploy (previews desligados); '**' casa branch com barra", () => {
    expect(vercel.git.deploymentEnabled).toEqual({ "**": false, main: true });
  });

  it("não fixa bunVersion: as funções rodam em Node", () => {
    expect(vercel.bunVersion).toBeUndefined();
  });
});

describe("package.json engines e CI", () => {
  it("fixa o Node 22.x (o padrão da Vercel não pode mudar a major sozinho)", () => {
    expect(pkg.engines.node).toBe("22.x");
  });

  it("o CI usa a mesma major do Node e tem ao menos um node-version", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const majors = [...ci.matchAll(/node-version:\s*"?(\d+)/g)].map(
      (match) => match[1],
    );
    expect(majors.length).toBeGreaterThan(0);
    for (const major of majors) {
      expect(major).toBe(String(pkg.engines.node).split(".")[0]);
    }
  });
});
