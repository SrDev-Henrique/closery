// Roteiro de interação por par (spec §6): os passos que rodam no app e, com outros alvos, no
// protótipo, antes da captura, da sonda ou da medida. validateSteps, globToRegExp e requestMatches são
// puros; runSteps recebe a página do Playwright pronta (este módulo não abre navegador).

/** @typedef {import("./screen.mjs").Target} Target */
/** @typedef {import("./screen.mjs").RequestMatch} RequestMatch */
/** @typedef {import("./screen.mjs").Step} Step */
/** @typedef {{ failed: { url: string, method: string, error: string }[], samples: { at: number, value: number | null }[], notes: string[] }} StepLog */

export const STEP_KINDS = Object.freeze([
  "click",
  "hover",
  "focus",
  "tab",
  "press",
  "fill",
  "drag",
  "wait",
  "waitFor",
  "failRequests",
  "restoreRequests",
  "sample",
]);

/** @type {Readonly<Record<string, { required: readonly string[], optional: readonly string[] }>>} */
const FIELDS = Object.freeze({
  click: { required: ["target"], optional: [] },
  hover: { required: ["target"], optional: [] },
  focus: { required: ["target"], optional: [] },
  tab: { required: ["times"], optional: [] },
  press: { required: ["key"], optional: [] },
  fill: { required: ["target", "value"], optional: [] },
  drag: { required: ["from", "to"], optional: [] },
  wait: { required: ["ms"], optional: [] },
  waitFor: { required: ["target"], optional: [] },
  failRequests: { required: ["match"], optional: ["times"] },
  restoreRequests: { required: [], optional: [] },
  sample: { required: ["target", "read", "every", "for"], optional: [] },
});

const SAMPLE_READS = Object.freeze(["x", "y", "width", "height"]);
const MAX_MS = 60_000;
const MAX_TABS = 50;
const MAX_FAILURES = 1_000;
const MIN_SAMPLE_EVERY = 10;
const WAIT_FOR_TIMEOUT = 60_000;

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function isMs(value) {
  return (
    Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_MS
  );
}

/**
 * @param {unknown} target
 * @returns {string | null} o erro, ou null se o alvo vale
 */
function targetError(target) {
  if (!isPlainObject(target)) return "alvo não é um objeto";
  const keys = Object.keys(target);
  if ("role" in target) {
    if (typeof target.role !== "string" || target.role === "")
      return "alvo.role vazio";
    if (typeof target.name !== "string" || target.name === "") {
      return "alvo.name vazio (o nome acessível)";
    }
    if ("exact" in target && typeof target.exact !== "boolean") {
      return "alvo.exact não é booleano";
    }
    const extra = keys.filter((k) => !["role", "name", "exact"].includes(k));
    return extra.length > 0
      ? `alvo com campo desconhecido: ${extra.join(", ")}`
      : null;
  }
  for (const kind of ["css", "text"]) {
    if (kind in target) {
      if (typeof target[kind] !== "string" || target[kind] === "")
        return `alvo.${kind} vazio`;
      return keys.length === 1
        ? null
        : `alvo { ${kind} } não aceita outros campos`;
    }
  }
  return "alvo sem role, css nem text";
}

/** @param {string} value */
function isRegexLiteral(value) {
  return value.length > 2 && value.startsWith("/") && value.endsWith("/");
}

/**
 * "/regex/" vira a RegExp de dentro; regex inválida vira null.
 * @param {string} value
 * @returns {RegExp | null}
 */
function regexOf(value) {
  try {
    return new RegExp(value.slice(1, -1));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} match
 * @returns {string | null}
 */
function matchError(match) {
  if (!isPlainObject(match)) return "match não é um objeto";
  const keys = Object.keys(match);
  if (keys.length === 0) return "match vazio (use url, method ou header)";
  const extra = keys.filter((k) => !["url", "method", "header"].includes(k));
  if (extra.length > 0)
    return `match com campo desconhecido: ${extra.join(", ")}`;
  for (const key of keys) {
    if (typeof match[key] !== "string" || match[key] === "")
      return `match.${key} vazio`;
  }
  if (
    typeof match.url === "string" &&
    isRegexLiteral(match.url) &&
    regexOf(match.url) === null
  ) {
    return "match.url: regex inválida";
  }
  return null;
}

/**
 * Valida a lista de passos. Lista vazia vale; a resposta é a lista de erros (vazia = válida), cada um
 * com o número do passo.
 * @param {unknown} steps
 * @returns {string[]}
 */
export function validateSteps(steps) {
  if (!Array.isArray(steps)) return ["passos: não é uma lista"];
  /** @type {string[]} */
  const errors = [];
  for (const [index, step] of steps.entries()) {
    const at = `passo ${index + 1}`;
    if (!isPlainObject(step)) {
      errors.push(`${at}: não é um objeto`);
      continue;
    }
    const kind = step.kind;
    if (typeof kind !== "string" || !STEP_KINDS.includes(kind)) {
      errors.push(`${at}: kind desconhecido: ${String(kind)}`);
      continue;
    }
    const label = `${at} (${kind})`;
    const { required, optional } = FIELDS[kind];
    for (const field of required) {
      if (!(field in step)) errors.push(`${label}: falta ${field}`);
    }
    const extra = Object.keys(step).filter(
      (k) => k !== "kind" && !required.includes(k) && !optional.includes(k),
    );
    if (extra.length > 0)
      errors.push(`${label}: campo desconhecido: ${extra.join(", ")}`);
    for (const field of ["target", "from", "to"]) {
      if (field in step) {
        const error = targetError(step[field]);
        if (error) errors.push(`${label}: ${field}: ${error}`);
      }
    }
    if ("times" in step) {
      const max = kind === "tab" ? MAX_TABS : MAX_FAILURES;
      if (!Number.isInteger(step.times) || step.times < 1 || step.times > max) {
        errors.push(
          `${label}: times inválido: ${String(step.times)} (1 a ${max})`,
        );
      }
    }
    if ("key" in step && (typeof step.key !== "string" || step.key === "")) {
      errors.push(`${label}: key vazia`);
    }
    if ("value" in step && typeof step.value !== "string") {
      errors.push(`${label}: value não é texto`);
    }
    if ("ms" in step && !isMs(step.ms)) {
      errors.push(`${label}: ms inválido: ${String(step.ms)} (1 a ${MAX_MS})`);
    }
    if ("match" in step) {
      const error = matchError(step.match);
      if (error) errors.push(`${label}: ${error}`);
    }
    if (kind === "sample") {
      if ("read" in step && !SAMPLE_READS.includes(step.read)) {
        errors.push(
          `${label}: read inválido: ${String(step.read)} (x, y, width ou height)`,
        );
      }
      if ("for" in step && !isMs(step.for)) {
        errors.push(
          `${label}: for inválido: ${String(step.for)} (1 a ${MAX_MS})`,
        );
      }
      if (
        "every" in step &&
        (!Number.isInteger(step.every) ||
          step.every < MIN_SAMPLE_EVERY ||
          (isMs(step.for) && step.every > step.for))
      ) {
        errors.push(
          `${label}: every inválido: ${String(step.every)} (${MIN_SAMPLE_EVERY} até o for)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Glob de URL em regex ancorada: `**` casa qualquer coisa (inclusive "/"), `*` casa dentro de um
 * segmento; o resto é literal.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let source = "";
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith("**", i)) {
      source += ".*";
      i += 2;
    } else if (glob[i] === "*") {
      source += "[^/]*";
      i += 1;
    } else {
      source += glob[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * A requisição casa com o match? Todos os campos dados precisam casar: `url` (glob ou regex entre
 * barras), `method` (sem caixa) e `header` (um nome que precisa existir, sem caixa). Match vazio não
 * casa nada. Server Action = { method: "POST", header: "next-action" }.
 * @param {RequestMatch} match
 * @param {{ url: string, method: string, headers: Record<string, string> }} req
 * @returns {boolean}
 */
export function requestMatches(match, req) {
  if (!isPlainObject(match) || Object.keys(match).length === 0) return false;
  if (typeof match.url === "string") {
    const pattern = isRegexLiteral(match.url)
      ? regexOf(match.url)
      : globToRegExp(match.url);
    if (!pattern || !pattern.test(req.url)) return false;
  }
  if (
    typeof match.method === "string" &&
    match.method.toUpperCase() !== String(req.method).toUpperCase()
  ) {
    return false;
  }
  if (typeof match.header === "string") {
    const wanted = match.header.toLowerCase();
    const names = Object.keys(req.headers ?? {}).map((name) =>
      name.toLowerCase(),
    );
    if (!names.includes(wanted)) return false;
  }
  return true;
}

/**
 * O alvo na página: só o visível (o Next mantém a página anterior escondida na navegação).
 * @param {import("@playwright/test").Page} page
 * @param {Target} target
 */
function locate(page, target) {
  let base;
  if ("role" in target) {
    base = page.getByRole(/** @type {any} */ (target.role), {
      name: target.name,
      exact: target.exact ?? false,
    });
  } else if ("css" in target) {
    base = page.locator(target.css);
  } else {
    base = page.getByText(target.text);
  }
  return base.filter({ visible: true }).first();
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {{ target: Target, read: "x" | "y" | "width" | "height", every: number, for: number }} step
 * @param {StepLog} log
 */
async function sample(page, step, log) {
  const target = locate(page, step.target);
  const start = Date.now();
  /** @type {number | null | undefined} */
  let last;
  while (Date.now() - start < step.for) {
    const box = await target
      .boundingBox({ timeout: step.every })
      .catch(() => null);
    const value = box ? Math.round(box[step.read]) : null;
    if (value !== last) {
      log.samples.push({ at: Date.now() - start, value });
      last = value;
    }
    await page.waitForTimeout(step.every);
  }
}

/**
 * Roda os passos na página e devolve o registro: as requisições que falharam (`requestfailed`), as
 * amostras e as notas. A falha de rede vale do `failRequests` até o `restoreRequests` (ou o fim).
 * @param {import("@playwright/test").Page} page
 * @param {Step[]} steps
 * @returns {Promise<StepLog>}
 */
export async function runSteps(page, steps) {
  const errors = validateSteps(steps);
  if (errors.length > 0) {
    throw new Error(`passos inválidos:\n- ${errors.join("\n- ")}`);
  }
  /** @type {StepLog} */
  const log = { failed: [], samples: [], notes: [] };
  /** @param {import("@playwright/test").Request} request */
  const onFailed = (request) => {
    log.failed.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText ?? "desconhecido",
    });
  };
  /** @type {{ match: RequestMatch, remaining: number } | null} */
  let failing = null;
  /** @param {import("@playwright/test").Route} route */
  const handler = async (route) => {
    const request = route.request();
    const hit =
      failing !== null &&
      failing.remaining !== 0 &&
      requestMatches(failing.match, {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
      });
    if (hit && failing) {
      if (failing.remaining > 0) failing.remaining -= 1;
      log.notes.push(`abortada: ${request.method()} ${request.url()}`);
      await route.abort("failed");
      return;
    }
    await route.fallback();
  };
  let routed = false;
  page.on("requestfailed", onFailed);
  try {
    for (const step of steps) {
      switch (step.kind) {
        case "click":
          await locate(page, step.target).click();
          break;
        case "hover":
          await locate(page, step.target).hover();
          break;
        case "focus":
          await locate(page, step.target).focus();
          break;
        case "tab":
          for (let n = 0; n < step.times; n++) await page.keyboard.press("Tab");
          break;
        case "press":
          await page.keyboard.press(step.key);
          break;
        case "fill":
          await locate(page, step.target).fill(step.value);
          break;
        case "drag":
          await locate(page, step.from).dragTo(locate(page, step.to));
          break;
        case "wait":
          await page.waitForTimeout(step.ms);
          break;
        case "waitFor":
          await locate(page, step.target).waitFor({
            state: "visible",
            timeout: WAIT_FOR_TIMEOUT,
          });
          break;
        case "failRequests":
          failing = { match: step.match, remaining: step.times ?? -1 };
          if (!routed) {
            await page.route("**/*", handler);
            routed = true;
          }
          break;
        case "restoreRequests":
          failing = null;
          if (routed) {
            await page.unroute("**/*", handler);
            routed = false;
          }
          break;
        case "sample":
          await sample(page, step, log);
          break;
        default:
          throw new Error(`kind sem runner: ${String(step.kind)}`);
      }
    }
  } finally {
    page.off("requestfailed", onFailed);
    if (routed) await page.unroute("**/*", handler);
  }
  return log;
}
