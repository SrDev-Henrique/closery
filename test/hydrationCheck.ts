// Verificador puro da hidratação (PR B, spec §8), usado pelo e2e/hydration.spec.ts.
//
// O PR A perdeu horas com conteúdo duplicado: um <script> num componente client acima
// dos <Suspense> fazia o React refazer a página no cliente, com o console vazio. O que
// denunciou foram os ids de `useId`: `_R_…_` (do servidor, que a hidratação preserva)
// contra `_r_…_` (gerados no cliente). `snapshotDom` roda na página; `hydrationProblems`
// é puro e testado em test/hydrationCheck.test.ts.

export type DomSnapshot = {
  mains: number;
  h1PerMain: number[];
  ids: string[];
  refs: string[];
};

/** Id de `useId` gerado no cliente (`_r_…_`; o do servidor é `_R_…_`). Casa dentro de ids compostos (`base-ui-_r_5_`). */
export const CLIENT_ID_PATTERN = /_r_[0-9a-z]*_/;

/**
 * Mensagem de hidratação no console ou num erro da página. No dev o React escreve o texto
 * ("Hydration failed…", "Switched to client rendering"); na produção (o `next start` do E2E) o
 * erro sai minificado, com o código: 418 (HTML diferente), 419 (o servidor não terminou o
 * Suspense) e 424 (a raiz refeita no cliente). O 422 e o 423 (erro ao hidratar, refeito no
 * cliente) não chegam com o código: o React põe o erro original no `cause` deles, e o
 * `onRecoverableError` do Next reporta só o `cause`, cuja mensagem não fala de hidratação. Os dois
 * ficam na expressão para o caso de o Next mudar; quem os pega hoje é o DOM (ids `_r_`, conteúdo
 * duplicado).
 */
const HYDRATION_MESSAGE =
  /hydrat|switched to client rendering|react\.dev\/errors\/(?:418|419|422|423|424)(?!\d)/i;

/**
 * O instantâneo do DOM. Roda dentro da página (`page.evaluate(snapshotDom)`): o Playwright manda o
 * texto da função, então ela não pode usar nada de fora dela (nem import, nem constante do módulo).
 */
export function snapshotDom(): DomSnapshot {
  const mains = Array.from(document.querySelectorAll("main"));
  const ids = Array.from(document.querySelectorAll("[id]"))
    .map((element) => element.id)
    .filter((id) => id !== "");
  const refs: string[] = [];
  const names = ["for", "aria-labelledby", "aria-describedby", "aria-controls"];
  const referrers = document.querySelectorAll(
    "[for], [aria-labelledby], [aria-describedby], [aria-controls]",
  );
  for (const element of Array.from(referrers)) {
    for (const name of names) {
      const value = element.getAttribute(name);
      if (value) refs.push(...value.split(/\s+/).filter(Boolean));
    }
  }
  return {
    mains: mains.length,
    h1PerMain: mains.map((main) => main.querySelectorAll("h1").length),
    ids,
    refs,
  };
}

/**
 * Os problemas de hidratação do instantâneo (vazio = ok): nenhum ou mais de um `<main>`, número de
 * `<h1>` por `<main>` diferente do esperado, id repetido, id ou referência no formato do cliente e
 * mensagem de hidratação entre os erros da página. Lança se `expectedH1` não for inteiro ≥ 0.
 */
export function hydrationProblems(
  snapshot: DomSnapshot,
  expectedH1: number,
  consoleErrors: readonly string[],
): string[] {
  if (!Number.isInteger(expectedH1) || expectedH1 < 0) {
    throw new Error(`expectedH1 inválido: ${expectedH1}`);
  }
  const problems: string[] = [];
  if (snapshot.mains === 0) problems.push("nenhum <main> na página");
  if (snapshot.mains > 1) {
    problems.push(
      `${snapshot.mains} elementos <main> (esperado 1): conteúdo duplicado`,
    );
  }
  for (const [index, count] of snapshot.h1PerMain.entries()) {
    if (count !== expectedH1) {
      problems.push(
        `<main> ${index + 1} com ${count} <h1> (esperado ${expectedH1})`,
      );
    }
  }
  const seen = new Map<string, number>();
  for (const id of snapshot.ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1) problems.push(`id repetido ${count} vezes: ${id}`);
    if (CLIENT_ID_PATTERN.test(id))
      problems.push(`id gerado no cliente: ${id}`);
  }
  for (const ref of new Set(snapshot.refs)) {
    if (CLIENT_ID_PATTERN.test(ref)) {
      problems.push(`referência a id gerado no cliente: ${ref}`);
    }
  }
  for (const message of consoleErrors) {
    if (HYDRATION_MESSAGE.test(message)) {
      problems.push(`hidratação no console: ${message.slice(0, 200)}`);
    }
  }
  return problems;
}
