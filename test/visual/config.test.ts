import { describe, expect, it } from "vitest";

import { INVITE_COOKIE } from "@/lib/auth/inviteCookie";
import { THEME_STORAGE_KEY as APP_THEME_STORAGE_KEY } from "@/lib/theme";
import {
  assertVisualBaseUrl,
  assertVisualDbUrl,
  FORBIDDEN_PORTS,
  fakeClientIp,
  MOBILE_MAX_WIDTH,
  parseCliArgs,
  parseSizes,
  THEME_STORAGE_KEY,
  VISUAL_APP_PORT,
  VISUAL_BASE_URL,
  VISUAL_DB_HOST,
  VISUAL_DB_PORT,
  VISUAL_DB_URL,
  VISUAL_INVITE_COOKIE,
} from "../../scripts/visual/config.mjs";

// Guarda das portas e dos argumentos das ferramentas visuais (spec §5.1, regra 3):
// banco 54332, app 3202, e nunca as portas dos outros.

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("portas e URLs", () => {
  it("o banco é 127.0.0.1:54332 e o app, a 3202, fora das portas proibidas", () => {
    expect(VISUAL_DB_HOST).toBe("127.0.0.1");
    expect(VISUAL_DB_PORT).toBe(54332);
    expect(VISUAL_APP_PORT).toBe(3202);
    expect(FORBIDDEN_PORTS).toEqual([3000, 3200, 3201, 54329, 54331]);
    expect(FORBIDDEN_PORTS).not.toContain(VISUAL_DB_PORT);
    expect(FORBIDDEN_PORTS).not.toContain(VISUAL_APP_PORT);
  });

  it("as URLs padrão passam na própria conferência", () => {
    expect(assertVisualDbUrl(VISUAL_DB_URL)).toBe(VISUAL_DB_URL);
    expect(assertVisualBaseUrl(VISUAL_BASE_URL)).toBe(VISUAL_BASE_URL);
    expect(assertVisualBaseUrl("http://127.0.0.1:3202/")).toBe(
      "http://127.0.0.1:3202/",
    );
  });

  it.each([
    ...FORBIDDEN_PORTS,
  ])("recusa o banco e o app na porta %i", (port) => {
    expect(() =>
      assertVisualDbUrl(
        `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
      ),
    ).toThrow("banco visual recusado");
    expect(() => assertVisualBaseUrl(`http://localhost:${port}`)).toThrow(
      "app visual recusado",
    );
  });

  it("recusa outro host, outro protocolo, sem porta e lixo, sem mostrar a senha", () => {
    const remote =
      "postgres://dono:segredo-de-teste@ep-exemplo.neon.tech:5432/neondb";
    const message = messageOf(() => assertVisualDbUrl(remote));
    expect(message).toContain("banco visual recusado");
    expect(message).not.toContain("segredo-de-teste");
    expect(() =>
      assertVisualDbUrl(
        "postgres://postgres:postgres@localhost:54332/postgres",
      ),
    ).toThrow("só 127.0.0.1:54332");
    expect(() => assertVisualDbUrl("mysql://root@127.0.0.1:54332/x")).toThrow(
      "protocolo mysql:",
    );
    expect(() =>
      assertVisualDbUrl("postgres://postgres@127.0.0.1/postgres"),
    ).toThrow("sem porta");
    expect(() => assertVisualDbUrl("não é url")).toThrow("URL inválida");
    expect(() => assertVisualBaseUrl("https://localhost:3202")).toThrow(
      "app visual recusado",
    );
    expect(() => assertVisualBaseUrl("http://exemplo.com:3202")).toThrow(
      "app visual recusado",
    );
    expect(() => assertVisualBaseUrl("http://localhost")).toThrow(
      "app visual recusado",
    );
  });

  it("a chave do tema e o cookie do convite são os mesmos do app", () => {
    expect(THEME_STORAGE_KEY).toBe(APP_THEME_STORAGE_KEY);
    expect(VISUAL_INVITE_COOKIE).toBe(INVITE_COOKIE);
  });

  it("celular é até 859px", () => {
    expect(MOBILE_MAX_WIDTH).toBe(859);
  });
});

describe("parseCliArgs", () => {
  it("separa as flags dos posicionais, na ordem", () => {
    expect(
      parseCliArgs(["admin", "--out=processo", "--all", "--sufixo=", "390"]),
    ).toEqual({
      flags: { out: "processo", all: true, sufixo: "" },
      positional: ["admin", "390"],
    });
  });

  it("o valor pode ter '=' (corta só no primeiro)", () => {
    expect(parseCliArgs(["--expr=a=b"]).flags).toEqual({ expr: "a=b" });
  });

  it("sem argumento, nada", () => {
    expect(parseCliArgs([])).toEqual({ flags: {}, positional: [] });
  });

  it("lança em nome inválido e em flag repetida", () => {
    expect(() => parseCliArgs(["--"])).toThrow("argumento inválido: --");
    expect(() => parseCliArgs(["--=x"])).toThrow("argumento inválido");
    expect(() => parseCliArgs(["---x"])).toThrow("argumento inválido");
    expect(() => parseCliArgs(["--__proto__=1"])).toThrow("argumento inválido");
    expect(() => parseCliArgs(["--out=a", "--out=b"])).toThrow(
      "argumento repetido: --out",
    );
  });
});

describe("parseSizes", () => {
  it("sem valor, uma cópia do padrão", () => {
    const fallback = [1440, 390];
    const sizes = parseSizes(undefined, fallback);
    expect(sizes).toEqual([1440, 390]);
    expect(sizes).not.toBe(fallback);
  });

  it("lê a lista, com espaços, até o máximo de 3840", () => {
    expect(parseSizes("1440,390", [])).toEqual([1440, 390]);
    expect(parseSizes(" 820 ", [])).toEqual([820]);
    expect(parseSizes("3840", [])).toEqual([3840]);
  });

  it("lança em vazio, zero, negativo, não inteiro, acima do máximo e buraco na lista", () => {
    expect(() => parseSizes("", [])).toThrow("tamanhos vazios");
    expect(() => parseSizes(" , ", [])).toThrow("tamanhos vazios");
    expect(() => parseSizes("0", [])).toThrow("tamanho inválido: 0");
    expect(() => parseSizes("-390", [])).toThrow('tamanho inválido: "-390"');
    expect(() => parseSizes("1.5", [])).toThrow('tamanho inválido: "1.5"');
    expect(() => parseSizes("3841", [])).toThrow("máximo 3840");
    expect(() => parseSizes("1440,,390", [])).toThrow('tamanho inválido: ""');
  });
});

describe("fakeClientIp", () => {
  it("monta 10.77.<a>.<b>, sem .0 no fim", () => {
    expect(fakeClientIp(0)).toBe("10.77.0.1");
    expect(fakeClientIp(253)).toBe("10.77.0.254");
    expect(fakeClientIp(254)).toBe("10.77.1.1");
    expect(fakeClientIp(65023)).toBe("10.77.255.254");
  });

  it("é diferente para cada n", () => {
    const ips = new Set(
      Array.from({ length: 1000 }, (_, n) => fakeClientIp(n)),
    );
    expect(ips.size).toBe(1000);
  });

  it("lança fora de 0..65023 e em não inteiro", () => {
    expect(() => fakeClientIp(-1)).toThrow("fakeClientIp");
    expect(() => fakeClientIp(1.5)).toThrow("fakeClientIp");
    expect(() => fakeClientIp(65024)).toThrow("fakeClientIp");
  });
});
