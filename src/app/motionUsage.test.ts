/**
 * Guarda do Motion (emenda de 2026-11-27; ui-rules §9, library-docs §23). Varre os `.ts` e `.tsx` de
 * `src/` (fora os testes) e recusa: (1) o `motion` pronto, o `framer-motion` e o `motion/react-client`
 * (só o `m`, dentro do LazyMotion); (2) nos arquivos que importam o Motion, número de duração ou de
 * mola e curva escrita no lugar dos nomes de `src/lib/motion.ts` (o único arquivo com os números).
 * E confere que o RootLayout põe o MotionProvider no <body> e continua com um script só (o do tema).
 *
 * Rodar: `bunx vitest run src/app/motionUsage.test.ts`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");

/** Os arquivos com os números (chave relativa a `src/`, com `/`). */
const TOKEN_FILES: ReadonlySet<string> = new Set(["lib/motion.ts"]);

const MOTION_IMPORT = /from\s+["']motion\/react(?:-m)?["']/;

const ANYWHERE: readonly (readonly [string, RegExp])[] = [
  [
    "motion pronto (use o m de motion/react-m)",
    /import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*["']motion\/react["']/,
  ],
  ["framer-motion direto", /from\s+["']framer-motion["']/],
  ["motion/react-client", /from\s+["']motion\/react-client["']/],
];

const IN_MOTION_FILES: readonly (readonly [string, RegExp])[] = [
  [
    "número de duração ou mola fora de src/lib/motion.ts",
    /\b(?:duration|visualDuration|stiffness|damping|mass|bounce|delay|repeatDelay)\s*:\s*-?\.?\d/,
  ],
  ["curva fora de src/lib/motion.ts", /\bease\s*:\s*[["'`]/],
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** Os nomes das regras que o código reprova (vazio = limpo). */
function motionViolations(source: string, key = ""): string[] {
  const code = stripComments(source);
  const found = ANYWHERE.filter(([, rule]) => rule.test(code)).map(
    ([name]) => name,
  );
  if (MOTION_IMPORT.test(code) && !TOKEN_FILES.has(key)) {
    for (const [name, rule] of IN_MOTION_FILES) {
      if (rule.test(code)) found.push(name);
    }
  }
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)
      ? [full]
      : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({
  key: relative(SRC, file).split("\\").join("/"),
  source: readFileSync(file, "utf8"),
}));

const motionFiles = files
  .filter(({ source }) => MOTION_IMPORT.test(stripComments(source)))
  .map(({ key }) => key)
  .sort();

const M = 'import * as m from "motion/react-m";\n';

describe("motionUsage", () => {
  it("as regras: o que pegam", () => {
    expect(motionViolations('import { motion } from "motion/react";')).toEqual([
      "motion pronto (use o m de motion/react-m)",
    ]);
    expect(
      motionViolations(
        'import { AnimatePresence, motion } from "motion/react";',
      ),
    ).toEqual(["motion pronto (use o m de motion/react-m)"]);
    expect(motionViolations('import { m } from "framer-motion";')).toEqual([
      "framer-motion direto",
    ]);
    expect(
      motionViolations('import * as m from "motion/react-client";'),
    ).toEqual(["motion/react-client"]);
    expect(
      motionViolations(`${M}<m.div transition={{ duration: 0.3 }} />`),
    ).toEqual(["número de duração ou mola fora de src/lib/motion.ts"]);
    expect(
      motionViolations(
        `${M}<m.div transition={{ type: "spring", bounce: .2 }} />`,
      ),
    ).toEqual(["número de duração ou mola fora de src/lib/motion.ts"]);
    expect(
      motionViolations(
        `${M}<m.div transition={{ ease: [0.2, 0.8, 0.2, 1] }} />`,
      ),
    ).toEqual(["curva fora de src/lib/motion.ts"]);
    expect(
      motionViolations(`${M}<m.div transition={{ ease: "easeOut" }} />`),
    ).toEqual(["curva fora de src/lib/motion.ts"]);
  });

  it("as regras: o que poupam", () => {
    expect(
      motionViolations(
        'import { type HTMLMotionProps, useSpring } from "motion/react";\nconst x = useSpring(0, MOTION_SPRING.knob);',
      ),
    ).toEqual([]);
    expect(
      motionViolations(
        `${M}<m.div transition={MOTION_SPRING.press} animate={{ x: 0, opacity: 1 }} />`,
      ),
    ).toEqual([]);
    expect(
      motionViolations(`${M}// duration: 3 só num comentário\n<m.div />`),
    ).toEqual([]);
    // Sem importar o Motion, um número de duração é de outra coisa (o toast do sonner).
    expect(
      motionViolations('toast.success("Salvo", { duration: 6000 });'),
    ).toEqual([]);
    // O arquivo dos tokens pode (e deve) ter os números.
    expect(
      motionViolations(
        'import type { Transition } from "motion/react";\nexport const X = { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] };',
        "lib/motion.ts",
      ),
    ).toEqual([]);
  });

  it("nenhum arquivo de src/ viola", () => {
    const violations = files.flatMap(({ key, source }) =>
      motionViolations(source, key).map((name) => `${key}: ${name}`),
    );
    expect(violations).toEqual([]);
  });

  it("os componentes que se mexem usam o Motion (M1 e M2)", () => {
    expect(motionFiles).toEqual(
      expect.arrayContaining([
        "components/app-shell/ThemeSwitch.tsx",
        "components/motion/MotionProvider.tsx",
        "components/motion/PressButton.tsx",
        "components/passagens/SectorColorFade.tsx",
        "components/passagens/SectorPicker.tsx",
        "components/ui/sheet.tsx",
        "components/ui/tooltip.tsx",
        "lib/motion.ts",
      ]),
    );
  });

  it("o RootLayout põe o MotionProvider no <body>, por fora do TooltipProvider e do Toaster, com um script só (o do tema)", () => {
    const layout = stripComments(
      readFileSync(join(SRC, "app", "layout.tsx"), "utf8"),
    );
    expect(layout).toContain(
      'import { MotionProvider } from "@/components/motion/MotionProvider";',
    );
    expect(layout).toMatch(
      /<body[^>]*>\s*<MotionProvider>\s*<TooltipProvider>\{children\}<\/TooltipProvider>\s*<Toaster \/>\s*<\/MotionProvider>\s*<\/body>/,
    );
    expect(layout.match(/<script\b/g) ?? []).toHaveLength(1);
  });
});
