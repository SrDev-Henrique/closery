import { describe, expect, it } from "vitest";

import {
  CSV_BOM,
  CSV_EOL,
  CSV_SEPARATOR,
  contentDisposition,
  csvDocument,
  csvNumberCell,
  csvPlainCell,
  csvResponseHeaders,
  csvRow,
  csvTextCell,
  exportFilename,
  neutralizeFormula,
} from "./csv";

const RANGE = { from: "2026-11-14", to: "2026-11-20" };
const EN_DASH = "\u{2013}";

describe("constantes", () => {
  it("BOM UTF-8, separador ; e CRLF", () => {
    expect(CSV_BOM).toBe("\u{feff}");
    expect(CSV_SEPARATOR).toBe(";");
    expect(CSV_EOL).toBe("\r\n");
  });
});

describe("neutralizeFormula", () => {
  it("cada caractere de fórmula na 1ª posição ganha '", () => {
    expect(neutralizeFormula('=HYPERLINK("http://x")')).toBe(
      '\'=HYPERLINK("http://x")',
    );
    expect(neutralizeFormula("+1")).toBe("'+1");
    expect(neutralizeFormula("-2")).toBe("'-2");
    expect(neutralizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeFormula("\t=1")).toBe("'\t=1");
    expect(neutralizeFormula("\r=1")).toBe("'\r=1");
  });

  it("no meio do texto nada muda", () => {
    expect(neutralizeFormula("Rede = 3")).toBe("Rede = 3");
    expect(neutralizeFormula("a+b")).toBe("a+b");
    expect(neutralizeFormula("a-b")).toBe("a-b");
    expect(neutralizeFormula("e-mail@x.test")).toBe("e-mail@x.test");
  });

  it("texto comum e vazio ficam como estão", () => {
    expect(neutralizeFormula("Ana Teste")).toBe("Ana Teste");
    expect(neutralizeFormula("")).toBe("");
  });

  it("um apóstrofo que já está na frente não é dobrado", () => {
    expect(neutralizeFormula("'=1")).toBe("'=1");
  });
});

describe("csvTextCell", () => {
  it("texto simples não leva aspas", () => {
    expect(csvTextCell("Ana Teste")).toBe("Ana Teste");
    expect(csvTextCell("")).toBe("");
  });

  it("neutraliza fórmula antes de proteger", () => {
    expect(csvTextCell("=SOMA(1)")).toBe("'=SOMA(1)");
    expect(csvTextCell("-2 rolos")).toBe("'-2 rolos");
  });

  it("ponto e vírgula vai entre aspas", () => {
    expect(csvTextCell("a;b")).toBe('"a;b"');
  });

  it("aspas viram aspas dobradas dentro de aspas", () => {
    expect(csvTextCell('disse "oi"')).toBe('"disse ""oi"""');
  });

  it("\\r\\n e \\r viram \\n e a célula vai entre aspas", () => {
    expect(csvTextCell("a\r\nb")).toBe('"a\nb"');
    expect(csvTextCell("a\rb")).toBe('"a\nb"');
    expect(csvTextCell("a\nb")).toBe('"a\nb"');
  });

  it("fórmula depois de neutralizada com quebra de linha: o CR inicial vira \\n", () => {
    expect(csvTextCell("\r=1")).toBe('"\'\n=1"');
  });

  it("acentos e emoji passam intactos", () => {
    expect(csvTextCell("Câmara – ação 🚚")).toBe("Câmara – ação 🚚");
  });
});

describe("csvPlainCell", () => {
  it("não neutraliza (um valor gerado pelo sistema nunca é fórmula)", () => {
    expect(csvPlainCell("-")).toBe("-");
    expect(csvPlainCell("=")).toBe("=");
  });

  it("mantém as mesmas aspas", () => {
    expect(csvPlainCell("a;b")).toBe('"a;b"');
    expect(csvPlainCell("20/11/2026")).toBe("20/11/2026");
  });
});

describe("csvNumberCell", () => {
  it("inteiro ≥ 0 sem separador", () => {
    expect(csvNumberCell(0)).toBe("0");
    expect(csvNumberCell(8)).toBe("8");
    expect(csvNumberCell(99_999)).toBe("99999");
  });

  it("recusa negativo, decimal e NaN", () => {
    expect(() => csvNumberCell(-1)).toThrow(RangeError);
    expect(() => csvNumberCell(1.5)).toThrow(RangeError);
    expect(() => csvNumberCell(Number.NaN)).toThrow(RangeError);
    expect(() => csvNumberCell(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("csvRow e csvDocument", () => {
  it("a linha junta com ; e termina em CRLF", () => {
    expect(csvRow(["a", "b", ""])).toBe("a;b;\r\n");
  });

  it("linha vazia (nenhuma célula) é só o CRLF", () => {
    expect(csvRow([])).toBe("\r\n");
  });

  it("o documento começa com o BOM e toda linha, a última também, termina em CRLF", () => {
    const text = csvDocument(["Dia", "Turno"], [["20/11/2026", "Manhã"]]);
    expect(text).toBe(`${CSV_BOM}Dia;Turno\r\n20/11/2026;Manhã\r\n`);
    expect(text.startsWith(CSV_BOM)).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
  });

  it("sem linhas: só o cabeçalho com o BOM", () => {
    expect(csvDocument(["Dia"], [])).toBe(`${CSV_BOM}Dia\r\n`);
  });

  it("o cabeçalho é texto de pessoa: nome de item que parece fórmula é neutralizado", () => {
    const text = csvDocument(["Dia", "=Rede (rede)"], []);
    expect(text).toBe(`${CSV_BOM}Dia;'=Rede (rede)\r\n`);
  });

  it("nenhum LF solto no documento: as quebras internas ficam entre aspas", () => {
    const text = csvDocument(
      ["Ocorrências"],
      [[csvTextCell("linha 1\r\nlinha 2")]],
    );
    expect(text).toBe(`${CSV_BOM}Ocorrências\r\n"linha 1\nlinha 2"\r\n`);
  });
});

describe("exportFilename", () => {
  it("setor com acento e espaço", () => {
    expect(exportFilename("Câmara Fria", RANGE)).toEqual({
      ascii: "passagens-camara-fria-2026-11-14_a_2026-11-20.csv",
      utf8: "passagens-Câmara Fria-2026-11-14_a_2026-11-20.csv",
    });
  });

  it("travessão e barra", () => {
    const name = exportFilename(`Câmara fria ${EN_DASH} ULD / 2`, RANGE);
    expect(name.ascii).toBe(
      "passagens-camara-fria-uld-2-2026-11-14_a_2026-11-20.csv",
    );
    expect(name.utf8).toBe(
      `passagens-Câmara fria ${EN_DASH} ULD - 2-2026-11-14_a_2026-11-20.csv`,
    );
  });

  it("sem setor: todos os setores", () => {
    expect(exportFilename(null, RANGE)).toEqual({
      ascii: "passagens-todos-os-setores-2026-11-14_a_2026-11-20.csv",
      utf8: "passagens-todos-os-setores-2026-11-14_a_2026-11-20.csv",
    });
  });

  it("caracteres proibidos no nome viram -", () => {
    const { utf8 } = exportFilename('a:b*c?d"e<f>g|h\\i\tj', RANGE);
    expect(utf8).toBe(
      "passagens-a-b-c-d-e-f-g-h-i-j-2026-11-14_a_2026-11-20.csv",
    );
  });

  it("slug cortado em 48 caracteres, sem - no fim", () => {
    const name = `${"a".repeat(47)} bbbbbb`;
    const { ascii } = exportFilename(name, RANGE);
    expect(ascii).toBe(
      `passagens-${"a".repeat(47)}-2026-11-14_a_2026-11-20.csv`,
    );
    const long = exportFilename("x".repeat(200), RANGE).ascii;
    expect(long).toBe(
      `passagens-${"x".repeat(48)}-2026-11-14_a_2026-11-20.csv`,
    );
  });

  it("nome sem nenhuma letra ASCII cai em 'setor'", () => {
    expect(exportFilename("日本", RANGE).ascii).toBe(
      "passagens-setor-2026-11-14_a_2026-11-20.csv",
    );
    expect(exportFilename("   ", RANGE).utf8).toBe(
      "passagens-setor-2026-11-14_a_2026-11-20.csv",
    );
  });

  it("o nome ASCII só tem caracteres seguros", () => {
    const { ascii } = exportFilename("Ünï cödé – Z/Y ✈", RANGE);
    expect(ascii).toMatch(/^[a-z0-9_.-]+$/);
  });
});

describe("contentDisposition", () => {
  it("exato para 'Câmara fria – ULD'", () => {
    const filename = exportFilename(`Câmara fria ${EN_DASH} ULD`, RANGE);
    expect(contentDisposition(filename)).toBe(
      `attachment; filename="passagens-camara-fria-uld-2026-11-14_a_2026-11-20.csv"; filename*=UTF-8''passagens-C%C3%A2mara%20fria%20%E2%80%93%20ULD-2026-11-14_a_2026-11-20.csv`,
    );
  });

  it("' ( ) * são codificados em maiúsculo (RFC 5987)", () => {
    const text = contentDisposition({ ascii: "a.csv", utf8: "a'(b)*.csv" });
    expect(text).toContain("filename*=UTF-8''a%27%28b%29%2A.csv");
  });
});

describe("csvResponseHeaders", () => {
  const headers = csvResponseHeaders(exportFilename("Câmara", RANGE));

  it("os quatro cabeçalhos do contrato", () => {
    expect(headers["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(headers["Cache-Control"]).toBe("private, no-store");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Disposition"]).toBe(
      contentDisposition(exportFilename("Câmara", RANGE)),
    );
    expect(Object.keys(headers)).toHaveLength(4);
  });

  it("new Headers() aceita (nenhum valor passa de 255)", () => {
    expect(() => new Headers(headers)).not.toThrow();
    const hostile = csvResponseHeaders(
      exportFilename(`Câmara ${EN_DASH} ✈ ${"é".repeat(300)}`, RANGE),
    );
    expect(() => new Headers(hostile)).not.toThrow();
  });
});
