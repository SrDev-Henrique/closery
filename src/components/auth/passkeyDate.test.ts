import { describe, expect, it } from "vitest";
import { formatPasskeyDate } from "./passkeyDate";

describe("formatPasskeyDate", () => {
  it("formata em pt-BR", () => {
    expect(formatPasskeyDate("2026-03-15T15:00:00.000Z")).toBe(
      "15 de mar. de 2026",
    );
  });

  it("aceita Date", () => {
    expect(formatPasskeyDate(new Date("2026-11-20T12:00:00.000Z"))).toBe(
      "20 de nov. de 2026",
    );
  });

  it("usa o dia no fuso America/Sao_Paulo, não o UTC", () => {
    // 01:30 UTC de 16/mar ainda é 22:30 de 15/mar em São Paulo.
    expect(formatPasskeyDate("2026-03-16T01:30:00.000Z")).toBe(
      "15 de mar. de 2026",
    );
  });

  it("devolve texto vazio para ausente ou data inválida", () => {
    expect(formatPasskeyDate(null)).toBe("");
    expect(formatPasskeyDate(undefined)).toBe("");
    expect(formatPasskeyDate("não é data")).toBe("");
  });
});
