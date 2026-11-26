// Texto da página /privacidade. RASCUNHO: o dono do produto precisa aprovar
// (decisão C6-5) e a empresa também, antes de convidar a primeira pessoa.
// Ao aprovar, troque PRIVACY_DRAFT para false (some o aviso da página) e
// atualize PRIVACY_UPDATED_AT, num PR curto depois da aprovação da empresa.
// Cada frase aqui só diz o que a configuração garante (runbook, passo B12).
export const PRIVACY_DRAFT: boolean = true;
export const PRIVACY_UPDATED_AT = "26 de novembro de 2026";

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export const PRIVACY_INTRO =
  "O Closery registra a passagem de turno da operação. Esta página explica, em poucas linhas, quais dados ficam guardados, para quê, quem vê e como pedir ajuda.";

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "dados",
    title: "O que guardamos",
    items: [
      "Seu nome e seu e-mail.",
      "Como você entra: a senha (guardada de forma que ninguém consegue ler) e as passkeys que você cadastrar.",
      "As passagens de turno, as solicitações e os comentários que você escreve, cada um com o seu nome e o horário.",
      "O endereço de rede (IP) e o navegador de cada acesso, para manter a sessão segura e limitar tentativas em excesso.",
      "Relatórios de erro do sistema, limpos antes do envio ao Sentry para não levar nome, e-mail nem o conteúdo das passagens.",
    ],
  },
  {
    id: "motivo",
    title: "Para que usamos",
    paragraphs: [
      "Para você entrar com segurança, para a equipe saber quem passou e quem recebeu cada turno, para acompanhar as solicitações e para corrigir falhas do sistema. Não usamos seus dados para publicidade nem os vendemos.",
    ],
  },
  {
    id: "quem-ve",
    title: "Quem vê",
    items: [
      "Operador: vê os dados do próprio setor.",
      "Administrador: vê os dados de todos os setores e cuida das contas.",
      "Fora a equipe, só o responsável pelo sistema (o dono do produto) e os serviços listados abaixo, que guardam os dados apenas para o sistema funcionar.",
    ],
  },
  {
    id: "onde",
    title: "Onde ficam",
    items: [
      "Aplicação: Vercel, com o processamento em São Paulo (Brasil); a Vercel guarda por 1 hora registros técnicos de acesso.",
      "Banco de dados: Neon, em São Paulo (Brasil).",
      "Relatórios de erro: Sentry, fora do Brasil, com o endereço de rede descartado.",
      "Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu) e o guarda numa pasta privada.",
    ],
  },
  {
    id: "prazo",
    title: "Por quanto tempo",
    paragraphs: [
      "Enquanto o piloto e o uso do sistema durarem. Quando alguém deixa a equipe, a conta é desativada e não apagada, para que as passagens e solicitações continuem mostrando quem as fez. Quem deixa a equipe perde o acesso na hora.",
    ],
  },
  {
    id: "direitos",
    title: "Seus direitos e contato",
    paragraphs: [
      "Você pode pedir para ver seus dados, corrigir um dado errado ou tirar uma dúvida sobre esta página. Fale com o administrador do seu setor: ele atende o pedido ou leva à empresa. Registros de passagens já confirmadas só mudam por correção do administrador, com motivo anotado.",
    ],
  },
];
