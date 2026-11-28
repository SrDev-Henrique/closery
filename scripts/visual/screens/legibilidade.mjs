// As 27 telas do passe de legibilidade do PR A (spec §5.5), para o audit.mjs. Semeie antes o estado
// rico (bun run visual:seed state geral:rico): {setor} vem do state.json; {pendente}, {corrigida} e
// {solicitacao} saem de consultas ao banco visual. Larguras extras de 820 onde há tabela ou lista.
// Sem nome de pessoa: quem vê é a Ana (admin) ou a Carla (operadora), e null é sem sessão.

const SETOR = "setor={setor}";
const WITH_LIST = [820];

/** @type {import("../screen.mjs").ScreenConfig} */
const legibilidade = {
  name: "legibilidade",
  states: {},
  audit: [
    { name: "entrar", path: "/entrar", person: null },
    {
      name: "convite-invalido",
      path: "/convite/token-invalido-de-teste",
      person: null,
    },
    { name: "redefinir-senha", path: "/redefinir-senha", person: null },
    { name: "privacidade", path: "/privacidade", person: null },
    { name: "bem-vindo", path: "/bem-vindo", person: "ana" },
    {
      name: "passagens",
      path: `/passagens?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "passagens-operador",
      path: "/passagens",
      person: "carla",
      extraWidths: WITH_LIST,
    },
    {
      name: "nova-passagem",
      path: `/?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
      steps: [
        { kind: "click", target: { role: "link", name: "Começar passagem" } },
        {
          kind: "waitFor",
          target: { role: "heading", name: "Passagem de turno" },
        },
      ],
    },
    { name: "passagem-pendente", path: "/passagens/{pendente}", person: "ana" },
    {
      name: "passagem-corrigida",
      path: "/passagens/{corrigida}",
      person: "ana",
    },
    {
      name: "passagem-operador",
      path: "/passagens/{corrigida}",
      person: "carla",
    },
    {
      name: "solicitacoes-quadro",
      path: `/solicitacoes?${SETOR}&visao=quadro`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "solicitacoes-lista",
      path: `/solicitacoes?${SETOR}&visao=lista`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "solicitacoes-tabela",
      path: `/solicitacoes?${SETOR}&visao=tabela`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "solicitacoes-operador",
      path: "/solicitacoes",
      person: "carla",
      extraWidths: WITH_LIST,
    },
    {
      // O detalhe rápido abre num Sheet pela navegação no cliente: a captura é só a janela.
      name: "solicitacao-sheet",
      path: `/solicitacoes?${SETOR}&visao=lista`,
      person: "ana",
      viewportOnly: true,
      steps: [
        { kind: "click", target: { css: 'a[href^="/solicitacoes/"]' } },
        { kind: "waitFor", target: { css: '[role="dialog"]' } },
      ],
    },
    {
      name: "solicitacao-pagina",
      path: "/solicitacoes/{solicitacao}",
      person: "carla",
    },
    {
      name: "dashboard",
      path: `/dashboard?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    { name: "dashboard-operador", path: "/dashboard", person: "carla" },
    { name: "conta", path: "/conta", person: "ana" },
    { name: "conta-operador", path: "/conta", person: "carla" },
    { name: "admin", path: "/admin", person: "ana" },
    {
      name: "admin-setores",
      path: "/admin/setores",
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-turnos",
      path: `/admin/turnos?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-itens",
      path: `/admin/itens?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-destinos",
      path: "/admin/destinos",
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-equipe",
      path: "/admin/equipe",
      person: "ana",
      extraWidths: WITH_LIST,
    },
  ],
};

export default legibilidade;
