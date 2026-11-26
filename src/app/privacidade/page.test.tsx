import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PRIVACY_DRAFT,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED_AT,
} from "@/features/privacy/privacyContent";
import Page, { metadata } from "./page";

describe("/privacidade", () => {
  it("o título da aba é Privacidade", () => {
    expect(metadata.title).toBe("Privacidade");
  });

  it("tem um h1 e uma seção (h2, region) para cada assunto", () => {
    render(<Page />);
    expect(
      screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent),
    ).toEqual(["Privacidade e seus dados"]);
    expect(PRIVACY_SECTIONS.map((section) => section.id)).toEqual([
      "dados",
      "motivo",
      "quem-ve",
      "onde",
      "prazo",
      "direitos",
    ]);
    for (const section of PRIVACY_SECTIONS) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.title }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: section.title }),
      ).toBeInTheDocument();
    }
  });

  it("o que guardamos diz IP e navegador de cada acesso e não promete ausência de dado pessoal", () => {
    render(<Page />);
    const stored = screen.getByRole("region", { name: "O que guardamos" });
    expect(
      within(stored).getByText(
        "O endereço de rede (IP) e o navegador de cada acesso, para manter a sessão segura e limitar tentativas em excesso.",
      ),
    ).toBeInTheDocument();
    expect(
      within(stored).getByText(
        "Relatórios de erro do sistema, limpos antes do envio ao Sentry para não levar nome, e-mail nem o conteúdo das passagens.",
      ),
    ).toBeInTheDocument();
    expect(stored.textContent).not.toMatch(/sem nenhum dado/i);
    expect(stored.textContent).not.toMatch(/sem dados pessoais/i);
  });

  it("quem vê cita o responsável pelo sistema e não diz que ninguém de fora da empresa vê", () => {
    render(<Page />);
    const who = screen.getByRole("region", { name: "Quem vê" });
    expect(
      within(who).getByText(
        "Fora a equipe, só o responsável pelo sistema (o dono do produto) e os serviços listados abaixo, que guardam os dados apenas para o sistema funcionar.",
      ),
    ).toBeInTheDocument();
    expect(who.textContent).not.toMatch(/ninguém de fora/i);
  });

  it("onde ficam: os quatro itens, na ordem, sem prometer mais do que a configuração garante", () => {
    render(<Page />);
    const where = screen.getByRole("region", { name: "Onde ficam" });
    expect(
      within(where)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Aplicação: Vercel, com o processamento em São Paulo (Brasil); a Vercel guarda por 1 hora registros técnicos de acesso.",
      "Banco de dados: Neon, em São Paulo (Brasil).",
      "Relatórios de erro: Sentry, fora do Brasil, com o endereço de rede descartado.",
      "Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu) e o guarda numa pasta privada.",
    ]);
  });

  it("diz que o contato é o administrador do setor e que a conta é desativada, não apagada", () => {
    render(<Page />);
    expect(
      screen.getByText(/Fale com o administrador do seu setor/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a conta é desativada e não apagada/),
    ).toBeInTheDocument();
  });

  it("mostra a data da última atualização", () => {
    render(<Page />);
    expect(
      screen.getByText(`Última atualização: ${PRIVACY_UPDATED_AT}.`),
    ).toBeInTheDocument();
  });

  it("o alerta de rascunho aparece se e só se PRIVACY_DRAFT é verdadeiro", () => {
    render(<Page />);
    const notice = screen.queryByText("Rascunho aguardando aprovação");
    if (PRIVACY_DRAFT) {
      expect(notice).toBeInTheDocument();
      expect(
        screen.getByText(
          "Este texto ainda não foi aprovado pelo dono do produto nem pela empresa.",
        ),
      ).toBeInTheDocument();
    } else {
      expect(notice).not.toBeInTheDocument();
    }
  });

  it("tem o link para voltar à entrada", () => {
    render(<Page />);
    expect(
      screen.getByRole("link", { name: "Voltar para a entrada" }),
    ).toHaveAttribute("href", "/entrar");
  });
});
