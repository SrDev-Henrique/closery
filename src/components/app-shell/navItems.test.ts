import { describe, expect, it } from "vitest";

import {
  isNavItemActive,
  NAV_ITEMS,
  visibleNavItems,
} from "@/components/app-shell/navItems";

describe("visibleNavItems", () => {
  it("operador vê Início, Passagens, Solicitações e Conta, sem Administração", () => {
    expect(visibleNavItems(false).map((item) => item.label)).toEqual([
      "Início",
      "Passagens",
      "Solicitações",
      "Conta",
    ]);
  });

  it("admin vê também Administração, por último", () => {
    expect(visibleNavItems(true).map((item) => item.label)).toEqual([
      "Início",
      "Passagens",
      "Solicitações",
      "Conta",
      "Administração",
    ]);
  });

  it("as rotas são as do contrato", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/passagens",
      "/solicitacoes",
      "/conta",
      "/admin",
    ]);
  });

  it("só Administração é restrita a admin", () => {
    expect(
      NAV_ITEMS.filter((item) => item.adminOnly).map((item) => item.href),
    ).toEqual(["/admin"]);
  });
});

describe("isNavItemActive", () => {
  it("Início só é ativo na raiz exata", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/conta", "/")).toBe(false);
    expect(isNavItemActive("/admin/equipe", "/")).toBe(false);
  });

  it("rota própria e subrotas são ativas", () => {
    expect(isNavItemActive("/conta", "/conta")).toBe(true);
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin/setores", "/admin")).toBe(true);
  });

  it("Passagens fica ativo na lista, na nova passagem e no resumo", () => {
    expect(isNavItemActive("/passagens", "/passagens")).toBe(true);
    expect(isNavItemActive("/passagens/nova", "/passagens")).toBe(true);
    expect(isNavItemActive("/passagens/abc", "/passagens")).toBe(true);
    expect(isNavItemActive("/", "/passagens")).toBe(false);
  });

  it("Solicitações fica ativo na tela e no detalhe, não em prefixo parecido", () => {
    expect(isNavItemActive("/solicitacoes", "/solicitacoes")).toBe(true);
    expect(isNavItemActive("/solicitacoes/abc", "/solicitacoes")).toBe(true);
    expect(isNavItemActive("/solicitacoes-antigas", "/solicitacoes")).toBe(
      false,
    );
    expect(isNavItemActive("/passagens", "/solicitacoes")).toBe(false);
  });

  it("prefixo parecido que não é subrota não é ativo", () => {
    expect(isNavItemActive("/contabilidade", "/conta")).toBe(false);
    expect(isNavItemActive("/administrador", "/admin")).toBe(false);
  });

  it("rota diferente não é ativa", () => {
    expect(isNavItemActive("/entrar", "/conta")).toBe(false);
  });
});
