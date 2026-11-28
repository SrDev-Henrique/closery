// Contraste e auditoria de legibilidade (spec §5.3). As cinco funções de cor são puras e sem
// closure: o auditScript() monta o script da página com String(fn) delas mesmas, então a página e o
// teste calculam com o mesmo código. A conta é a do WCAG 2.x (a mesma do themeContrast.test.ts).

/** @typedef {[number, number, number, number]} Rgba — r, g, b de 0 a 255; alfa de 0 a 1 */

/**
 * Cor computada do navegador ("rgb(…)", "rgba(…)", "rgb(r g b / a)", "transparent") em [r, g, b, a];
 * o que não for sRGB (oklch, lab, lixo) vira null.
 * @param {unknown} css
 * @returns {Rgba | null}
 */
export function parseColor(css) {
  if (typeof css !== "string") return null;
  const value = css.trim().toLowerCase();
  if (value === "transparent") return [0, 0, 0, 0];
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const numbers = parts.map((part, index) =>
    index === 3 && part.endsWith("%")
      ? Number(part.slice(0, -1)) / 100
      : Number(part),
  );
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [r, g, b, a = 1] = numbers;
  if ([r, g, b].some((c) => c < 0 || c > 255) || a < 0 || a > 1) return null;
  return [r, g, b, a];
}

/**
 * Compõe a cor de cima (com alfa) sobre a de baixo (opaca).
 * @param {Rgba} top
 * @param {Rgba} bottom
 * @returns {Rgba}
 */
export function over(top, bottom) {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

/**
 * Luminância relativa (WCAG 2.x), de 0 (preto) a 1 (branco).
 * @param {readonly number[]} rgb
 * @returns {number}
 */
export function luminance(rgb) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2])
  );
}

/**
 * Razão de contraste entre duas cores opacas, de 1 a 21.
 * @param {readonly number[]} a
 * @param {readonly number[]} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * O mínimo do WCAG AA: 3 para texto grande (24px, ou 18,66px em negrito), 4,5 para o resto.
 * @param {number} fontSizePx
 * @param {number} fontWeight
 * @returns {3 | 4.5}
 */
export function requiredRatio(fontSizePx, fontWeight) {
  return fontSizePx >= 24 || (fontWeight >= 700 && fontSizePx >= 18.66)
    ? 3
    : 4.5;
}

// Roda na página (dentro do auditScript): contraste de texto, alvo de toque abaixo de 860px,
// rolagem horizontal, borda e preenchimento de campo e fundo que some no do pai. Usa só as funções
// acima e o DOM.
function auditPage() {
  const backgroundOf = (element) => {
    const chain = [];
    for (let e = element; e; e = e.parentElement) {
      const style = getComputedStyle(e);
      const image = style.backgroundImage;
      if (image && image !== "none" && !image.startsWith("linear-gradient"))
        return null;
      const color = parseColor(style.backgroundColor);
      if (color && color[3] > 0) {
        chain.push(color);
        if (color[3] >= 1) break;
      }
    }
    let base = [255, 255, 255, 1];
    if (chain.length > 0 && chain[chain.length - 1][3] >= 1) {
      base = chain.pop();
    } else {
      const body = parseColor(getComputedStyle(document.body).backgroundColor);
      if (body) base = body;
    }
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  };
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return !element.closest(
      "[aria-hidden=true],.sr-only,[hidden],nextjs-portal",
    );
  };
  const dimmed = (element) => {
    for (let e = element; e; e = e.parentElement) {
      if (Number(getComputedStyle(e).opacity) < 1) return true;
    }
    return false;
  };
  const label = (element) => {
    const slot = element.getAttribute("data-slot");
    return element.tagName.toLowerCase() + (slot ? `[${slot}]` : "");
  };
  const rgb = (color) => `rgb(${color.slice(0, 3).map(Math.round).join(",")})`;
  const round = (value) => Math.round(value * 100) / 100;

  const out = {
    contrast: [],
    targets: [],
    overflow: null,
    inputs: [],
    sameBg: [],
  };
  const viewport = window.innerWidth;
  if (document.documentElement.scrollWidth > viewport + 1) {
    out.overflow = document.documentElement.scrollWidth;
  }
  for (const element of document.querySelectorAll("body *")) {
    if (!visible(element)) continue;
    const style = getComputedStyle(element);

    const own = [...element.childNodes]
      .filter((node) => node.nodeType === 3 && node.textContent.trim())
      .map((node) => node.textContent.trim())
      .join(" ");
    const isField =
      element.tagName === "INPUT" || element.tagName === "TEXTAREA";
    const placeholder =
      isField && element.placeholder && !element.value
        ? element.placeholder
        : "";
    if ((own || placeholder) && !element.disabled && !dimmed(element)) {
      const background = backgroundOf(element);
      const raw = parseColor(
        placeholder
          ? getComputedStyle(element, "::placeholder").color
          : style.color,
      );
      if (background && raw) {
        const ratio = contrastRatio(over(raw, background), background);
        const need = requiredRatio(
          parseFloat(style.fontSize),
          Number(style.fontWeight),
        );
        if (ratio < need) {
          out.contrast.push({
            text: (placeholder ? `[placeholder] ${placeholder}` : own).slice(
              0,
              60,
            ),
            el: label(element),
            ratio: round(ratio),
            need,
            fg: style.color,
            bg: rgb(background),
          });
        }
      }
    }

    const interactive = element.matches(
      "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=radio],[role=checkbox],[role=switch],[role=tab],[role=combobox],summary",
    );
    if (interactive && viewport < 860 && !element.disabled) {
      const box = element.getBoundingClientRect();
      if (box.height < 44 || box.width < 44) {
        // Link dentro de uma frase é exceção do WCAG 2.5.8: marcado como "inline".
        const parentText = element.parentElement
          ? element.parentElement.textContent.trim()
          : "";
        const inline =
          element.tagName === "A" &&
          style.display === "inline" &&
          parentText.length > element.textContent.trim().length + 10;
        out.targets.push({
          el: label(element),
          text: (
            element.getAttribute("aria-label") ||
            element.textContent ||
            element.getAttribute("type") ||
            ""
          )
            .trim()
            .slice(0, 40),
          w: Math.round(box.width),
          h: Math.round(box.height),
          inline,
        });
      }
    }

    if (
      element.matches(
        "input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[data-slot=select-trigger],[data-slot=input-group]",
      )
    ) {
      const parentBackground = element.parentElement
        ? backgroundOf(element.parentElement)
        : null;
      const ownBackground = backgroundOf(element);
      const borderColor = parseColor(style.borderTopColor);
      if (parentBackground && ownBackground && borderColor) {
        const borderWidth = parseFloat(style.borderTopWidth);
        const border =
          borderWidth > 0
            ? contrastRatio(
                over(borderColor, parentBackground),
                parentBackground,
              )
            : 1;
        out.inputs.push({
          el: label(element),
          name:
            element.name ||
            element.id ||
            element.getAttribute("aria-label") ||
            "",
          border: round(border),
          fill: round(contrastRatio(ownBackground, parentBackground)),
        });
      }
    }

    // Fundo próprio igual ao do pai (o bloco some), com área relevante e sem borda nem sombra.
    const color = parseColor(style.backgroundColor);
    if (color && color[3] > 0 && element.parentElement) {
      const box = element.getBoundingClientRect();
      if (
        box.width * box.height > 1200 &&
        parseFloat(style.borderTopWidth) === 0 &&
        style.boxShadow === "none"
      ) {
        const parentBackground = backgroundOf(element.parentElement);
        const ownBackground = backgroundOf(element);
        if (
          parentBackground &&
          ownBackground &&
          contrastRatio(parentBackground, ownBackground) < 1.03 &&
          style.backgroundColor !==
            getComputedStyle(element.parentElement).backgroundColor
        ) {
          const classes =
            typeof element.className === "string" ? element.className : "";
          out.sameBg.push({
            el: label(element),
            cls: classes
              .split(" ")
              .filter((name) => /^(bg-|hover:bg|rounded)/.test(name))
              .join(" ")
              .slice(0, 80),
            text: element.textContent.trim().slice(0, 40),
            w: Math.round(box.width),
            h: Math.round(box.height),
          });
        }
      }
    }
  }
  return out;
}

/**
 * O script da auditoria para o `page.evaluate`: as funções de cor e a auditoria, montadas com
 * String(fn), numa expressão que devolve o resultado.
 * @returns {string}
 */
export function auditScript() {
  const parts = [
    parseColor,
    over,
    luminance,
    contrastRatio,
    requiredRatio,
    auditPage,
  ].map(String);
  return `(() => {\n${parts.join("\n")}\nreturn auditPage();\n})()`;
}
