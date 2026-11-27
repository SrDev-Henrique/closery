// Fixtures da Satoshi: o CSS que a Fontshare devolve, no formato real (3 blocos @font-face, cada um
// com woff2, woff e ttf, URLs `//cdn.fontshare.com/wf/<A>/<B>/<C>.<ext>`), com IDs inventados.
// Os bytes são de mentira: o hash esperado dos testes é calculado em cima deles.

export const FONT_WEIGHTS = [500, 700, 900] as const;

export function fixtureUrl(weight: number, ext = "woff2"): string {
  return `//cdn.fontshare.com/wf/AAAAAAAA${weight}/BBBBBBBB${weight}/CCCCCCCC${weight}.${ext}`;
}

function fontFaceBlock(weight: number): string {
  return `@font-face {
  font-family: 'Satoshi';
  src: url('${fixtureUrl(weight, "woff2")}') format('woff2'),
       url('${fixtureUrl(weight, "woff")}') format('woff'),
       url('${fixtureUrl(weight, "ttf")}') format('truetype');
  font-weight: ${weight};
  font-display: swap;
  font-style: normal;
}
`;
}

/** O CSS da Fontshare para `satoshi@500,700,900`. */
export function fontshareCss(
  weights: readonly number[] = FONT_WEIGHTS,
): string {
  return `/* Satoshi */\n${weights.map(fontFaceBlock).join("")}\n`;
}

/** Bytes de mentira de cada peso (3 bytes cada). */
export function fakeFontBytes(weight: number): Uint8Array {
  return Uint8Array.from([weight % 251, 1, 2]);
}
