import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PRIVACY_DRAFT,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED_AT,
} from "@/features/privacy/privacyContent";
import Page, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// Os textos aprovados da página, literal a literal, escritos aqui de propósito
// (e não lidos de privacyContent): uma frase que mudar sem passar por este
// arquivo reprova. Quando o B12 do runbook mudar o texto, esta tabela muda no
// mesmo PR.
const APPROVED_INTRO =
  "O Closery registra a passagem de turno da operação. Esta página explica, em poucas linhas, quais dados ficam guardados, para quê, quem vê e como pedir ajuda.";

const APPROVED_SECTIONS = [
  {
    title: "O que guardamos",
    paragraphs: [],
    items: [
      "Seu nome e seu e-mail.",
      "Como você entra: a senha (guardada de forma que ninguém consegue ler) e as passkeys que você cadastrar.",
      "As passagens de turno, as solicitações e os comentários que você escreve, cada um com o seu nome e o horário.",
      "O endereço de rede (IP) e o navegador de cada acesso, para manter a sessão segura e limitar tentativas em excesso.",
      "Relatórios de erro do sistema, enviados ao Sentry sem e-mail, sem o conteúdo das consultas ao banco e sem links; o responsável pelo sistema os revê todo dia para conferir que nenhum traz dado de pessoa.",
    ],
  },
  {
    title: "Para que usamos",
    paragraphs: [
      "Para você entrar com segurança, para a equipe saber quem passou e quem recebeu cada turno, para acompanhar as solicitações e para corrigir falhas do sistema. Não usamos seus dados para publicidade nem os vendemos.",
    ],
    items: [],
  },
  {
    title: "Quem vê",
    paragraphs: [],
    items: [
      "Operador: vê os dados do próprio setor.",
      "Administrador: vê os dados de todos os setores e cuida das contas.",
      "Fora a equipe, só o responsável pelo sistema (o dono do produto) e os serviços listados abaixo, que guardam os dados apenas para o sistema funcionar.",
    ],
  },
  {
    title: "Onde ficam",
    paragraphs: [],
    items: [
      "Aplicação: Vercel, com o processamento em São Paulo (Brasil); a Vercel guarda por 1 hora registros técnicos de acesso.",
      "Banco de dados: Neon, em São Paulo (Brasil).",
      "Relatórios de erro: Sentry, fora do Brasil, com o endereço de rede descartado.",
      "Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu, as observações e as ocorrências do turno) e o guarda numa pasta privada.",
    ],
  },
  {
    title: "Por quanto tempo",
    paragraphs: [
      "Enquanto o piloto e o uso do sistema durarem. Quando alguém deixa a equipe, a conta é desativada e não apagada, para que as passagens e solicitações continuem mostrando quem as fez. Quem deixa a equipe perde o acesso na hora.",
    ],
    items: [],
  },
  {
    title: "Seus direitos e contato",
    paragraphs: [
      "Você pode pedir para ver seus dados, corrigir um dado errado ou tirar uma dúvida sobre esta página. Fale com o administrador do sistema: ele atende o pedido ou leva à empresa. Registros de passagens já confirmadas só mudam por correção do administrador, com motivo anotado.",
    ],
    items: [],
  },
];

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

  it("todos os textos aprovados, literal a literal, em cada seção", () => {
    render(<Page />);
    expect(PRIVACY_INTRO).toBe(APPROVED_INTRO);
    expect(
      screen.getByText(APPROVED_INTRO, { exact: true }),
    ).toBeInTheDocument();
    expect(PRIVACY_SECTIONS.map((section) => section.title)).toEqual(
      APPROVED_SECTIONS.map((section) => section.title),
    );
    for (const approved of APPROVED_SECTIONS) {
      const region = screen.getByRole("region", { name: approved.title });
      const paragraphs = Array.from(region.querySelectorAll("p")).map(
        (p) => p.textContent,
      );
      const items = within(region)
        .queryAllByRole("listitem")
        .map((item) => item.textContent);
      expect(paragraphs).toEqual(approved.paragraphs);
      expect(items).toEqual(approved.items);
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
        "Relatórios de erro do sistema, enviados ao Sentry sem e-mail, sem o conteúdo das consultas ao banco e sem links; o responsável pelo sistema os revê todo dia para conferir que nenhum traz dado de pessoa.",
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
      "Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu, as observações e as ocorrências do turno) e o guarda numa pasta privada.",
    ]);
  });

  it("diz que o contato é o administrador do sistema e que a conta é desativada, não apagada", () => {
    render(<Page />);
    expect(
      screen.getByText(/Fale com o administrador do sistema/),
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

  it("tem o controle Voltar, com /entrar como destino sem histórico", () => {
    render(<Page />);
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute(
      "href",
      "/entrar",
    );
  });
});
