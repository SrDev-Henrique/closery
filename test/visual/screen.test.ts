import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { sddDir } from "../../scripts/visual/paths.mjs";
import {
  loadScreen,
  minHeight,
  pickState,
  protoFile,
  resolvePath,
  seedArgs,
  validateScreen,
} from "../../scripts/visual/screen.mjs";

// A configuração de tela (spec §5.5): validação, caminho com marcadores, altura mínima,
// o arquivo da cópia do protótipo e o comando do seed.

const STATE = {
  seed: "inicio:admin",
  person: "ana",
  theme: "dark",
  path: "/?setor={setor}",
  proto: "proto-admin-escuro",
};

function screenWith(
  states: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return { name: "teste", ready: "main", states, ...extra };
}

describe("validateScreen", () => {
  it("uma tela mínima é válida", () => {
    expect(validateScreen(screenWith({ admin: STATE }))).toEqual([]);
  });

  it("não objeto, sem estados nem audit, sem ready e campo desconhecido", () => {
    expect(validateScreen(null)).toEqual(["a configuração não é um objeto"]);
    expect(validateScreen({ name: "teste", states: {} })).toEqual([
      "a tela precisa de states ou de audit",
    ]);
    expect(validateScreen({ name: "teste", states: { admin: STATE } })).toEqual(
      ["ready: o seletor que diz que a página do app carregou"],
    );
    expect(
      validateScreen(screenWith({ admin: STATE }, { prontos: "x" })),
    ).toEqual(["tela: campo desconhecido: prontos"]);
    expect(
      validateScreen(screenWith({ admin: STATE }, { name: "Tela 1" })),
    ).toEqual(["name: letras minúsculas, números e hífen"]);
  });

  it("pessoa, tema, caminho, cópia e seed", () => {
    const errors = validateScreen(
      screenWith({
        a: { ...STATE, person: "maria" },
        b: { ...STATE, theme: "sepia" },
        c: { ...STATE, path: "https://exemplo.test/" },
        d: { ...STATE, proto: "Proto Admin.html" },
        e: { ...STATE, seed: "admin" },
        f: { seed: "inicio:admin", person: "ana", theme: "dark", path: "/" },
      }),
    );
    expect(errors).toEqual([
      "estado a: person desconhecida: maria (ana, bruno, carla, diego)",
      "estado b: theme é dark ou light",
      "estado c: path é um caminho do app começando com /",
      "estado d: proto é o nome da cópia sem .html, ou null",
      "estado e: seed no formato <tela>:<estado>",
      "estado f: falta proto (o nome da cópia, ou null para só o app)",
    ]);
  });

  it("larguras: vazia, zero, abaixo de 320, acima de 3840, repetida", () => {
    const errors = validateScreen(
      screenWith({
        a: { ...STATE, sizes: [] },
        b: { ...STATE, sizes: [0] },
        c: { ...STATE, sizes: [319, 3841] },
        d: { ...STATE, sizes: [390, 390] },
      }),
    );
    expect(errors).toEqual([
      "estado a: sizes: lista de larguras vazia",
      "estado b: sizes: largura inválida: 0 (320 a 3840)",
      "estado c: sizes: largura inválida: 319 (320 a 3840)",
      "estado c: sizes: largura inválida: 3841 (320 a 3840)",
      "estado d: sizes: largura repetida",
    ]);
  });

  it("passos: os erros do validateSteps com o lado; protótipo nulo não tem passos nem regiões", () => {
    const errors = validateScreen(
      screenWith({
        a: { ...STATE, steps: { app: [{ kind: "wait" }] } },
        b: {
          ...STATE,
          proto: null,
          steps: { proto: [] },
          regions: { cartao: "x" },
        },
        c: { ...STATE, steps: { meio: [] } },
      }),
    );
    expect(errors).toEqual([
      "estado a: steps.app: passo 1 (wait): falta ms",
      "estado b: steps.proto sem cópia do protótipo",
      "estado b: região sem cópia do protótipo",
      "estado c: steps: campo desconhecido: meio",
    ]);
  });

  it("expect.failedRequests exige um passo failRequests no app e um inteiro ≥ 1", () => {
    const fail = {
      kind: "failRequests",
      match: { method: "POST", header: "next-action" },
    };
    expect(
      validateScreen(
        screenWith({
          a: {
            ...STATE,
            proto: null,
            steps: { app: [fail] },
            expect: { failedRequests: 1 },
          },
        }),
      ),
    ).toEqual([]);
    expect(
      validateScreen(
        screenWith({ a: { ...STATE, expect: { failedRequests: 1 } } }),
      ),
    ).toEqual([
      "estado a: expect.failedRequests sem um passo failRequests no app",
    ]);
    expect(
      validateScreen(
        screenWith({
          a: {
            ...STATE,
            steps: { app: [fail] },
            expect: { failedRequests: 0 },
          },
        }),
      ),
    ).toEqual(["estado a: expect.failedRequests inválido: 0 (inteiro ≥ 1)"]);
  });

  it("patch, masks, protoDir e região com nome ou expressão inválidos", () => {
    const errors = validateScreen(
      screenWith(
        { a: { ...STATE, regions: { Cartão: "" } } },
        { patch: { read: "x" }, masks: "", protoDir: "../fora" },
      ),
    );
    expect(errors).toEqual([
      "protoDir: pasta relativa ao --out, sem ..",
      "estado a: região Cartão: nome inválido",
      "estado a: região Cartão: a expressão que devolve [x, y, w, h]",
      "patch: { read, write }, as duas expressões",
      "masks: a expressão que devolve os retângulos",
    ]);
  });

  it("audit: pessoa nula vale, nome repetido e caminho inválido não", () => {
    const audit = [
      { name: "entrar", path: "/entrar", person: null },
      { name: "entrar", path: "/conta", person: "ana", extraWidths: [820] },
      { name: "conta", path: "conta", person: "zé" },
    ];
    expect(validateScreen({ name: "leg", states: {}, audit })).toEqual([
      "audit 2: name repetido: entrar",
      "audit 3: path é um caminho do app começando com /",
      "audit 3: person desconhecida: zé (ou null, sem sessão)",
    ]);
    expect(
      validateScreen({ name: "leg", states: {}, audit: audit.slice(0, 1) }),
    ).toEqual([]);
  });
});

describe("pickState", () => {
  const screen = {
    name: "teste",
    ready: "main",
    states: { admin: STATE },
  } as never;

  it("devolve o estado pelo nome", () => {
    expect(pickState(screen, "admin")).toBe(STATE);
  });

  it("estado desconhecido (ou herdado do Object) lança com os nomes que existem", () => {
    expect(() => pickState(screen, "menu")).toThrow(
      "estado desconhecido na tela teste: menu (estados: admin)",
    );
    expect(() => pickState(screen, "toString")).toThrow("estado desconhecido");
    expect(() => pickState(screen, undefined)).toThrow("estado desconhecido");
  });
});

describe("resolvePath", () => {
  it("troca {setor} pelo id, codificado", () => {
    expect(resolvePath("/?setor={setor}", { sectorId: "a b" })).toBe(
      "/?setor=a%20b",
    );
    expect(resolvePath("/conta", { sectorId: "" })).toBe("/conta");
  });

  it("os outros marcadores vêm do segundo argumento", () => {
    expect(
      resolvePath("/passagens/{pendente}?setor={setor}", {
        sectorId: "s1",
        pendente: "p1",
      }),
    ).toBe("/passagens/p1?setor=s1");
  });

  it("marcador sem valor lança", () => {
    expect(() => resolvePath("/?setor={setor}", { sectorId: "" })).toThrow(
      "marcador sem valor: {setor}",
    );
    expect(() =>
      resolvePath("/solicitacoes/{solicitacao}", { sectorId: "s1" }),
    ).toThrow("marcador sem valor: {solicitacao}");
  });
});

describe("minHeight", () => {
  it("844 até 859px, 900 a partir de 860", () => {
    expect(minHeight(390)).toBe(844);
    expect(minHeight(859)).toBe(844);
    expect(minHeight(860)).toBe(900);
    expect(minHeight(1440)).toBe(900);
  });
});

describe("protoFile", () => {
  it("monta <sdd>/<out>/<protoDir>/<cópia>.html, com proto por padrão", () => {
    expect(protoFile("processo", {}, "proto-admin-escuro")).toBe(
      join(sddDir(), "processo", "proto", "proto-admin-escuro.html"),
    );
    expect(protoFile("processo", { protoDir: "proto-pack" }, "proto-x")).toBe(
      join(sddDir(), "processo", "proto-pack", "proto-x.html"),
    );
  });

  it("recusa out fora de .git/sdd e nome de cópia com caminho", () => {
    expect(() => protoFile("../..", {}, "proto-x")).toThrow("fora de");
    expect(() => protoFile("processo", {}, "../proto-x")).toThrow(
      "cópia do protótipo inválida",
    );
  });
});

describe("seedArgs", () => {
  it("o comando do seed, com o --setor só quando o estado tem setor", () => {
    expect(seedArgs({ seed: "inicio:admin" })).toEqual([
      "scripts/visual/seed/index.ts",
      "state",
      "inicio:admin",
    ]);
    expect(seedArgs({ seed: "inicio:entregue", sector: "Operações" })).toEqual([
      "scripts/visual/seed/index.ts",
      "state",
      "inicio:entregue",
      "--setor=Operações",
    ]);
  });
});

describe("loadScreen", () => {
  it("carrega a tela versionada pelo nome", async () => {
    const screen = await loadScreen({ screen: "inicio" });
    expect(screen.name).toBe("inicio");
  });

  it("exige um dos dois, recusa nome com caminho e config fora de .git/sdd", async () => {
    await expect(loadScreen({})).rejects.toThrow(
      "use --screen=<nome> ou --config=",
    );
    await expect(
      loadScreen({ screen: "inicio", config: "x.mjs" }),
    ).rejects.toThrow("um dos dois");
    await expect(loadScreen({ screen: "../inicio" })).rejects.toThrow(
      "nome de tela inválido",
    );
    await expect(loadScreen({ config: "../../package.json" })).rejects.toThrow(
      "fora de",
    );
  });

  it("tela que não existe: diz qual", async () => {
    await expect(loadScreen({ screen: "nao-existe" })).rejects.toThrow(
      "não consegui carregar screens/nao-existe.mjs",
    );
  });
});
