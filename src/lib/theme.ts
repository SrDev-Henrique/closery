// Tema próprio (claro/escuro). Sem `next-themes`: o <script> que ele renderiza dentro de um componente
// client, acima dos <Suspense>, faz o React refazer no cliente os trechos dinâmicos do Cache Components e a
// cópia do servidor sobra (conteúdo duplicado). Aqui o script mora no <head> do layout raiz (Server
// Component) e o estado é só a classe `dark` do <html> + a chave no localStorage.
// Puro, sem `server-only`: o layout importa o script e o hook (`useTheme.ts`) importa o resto.

export const THEME_STORAGE_KEY = "closery-tema";

export type Theme = "dark" | "light";

// Roda antes da primeira pintura. O escuro é o padrão e o tema NÃO segue o sistema (C-V4): só o valor
// exato "light" guardado vale como claro; qualquer outra coisa (vazio, lixo, storage bloqueado) é escuro.
export const THEME_INIT_SCRIPT = `(function(){var t="dark";try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")t="light"}catch(e){}var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t})()`;

const listeners = new Set<() => void>();

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function notify() {
  for (const cb of listeners) cb();
}

export function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  apply(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage bloqueado: o tema vale só nesta página.
  }
  notify();
}

function onStorage(event: StorageEvent) {
  if (event.key !== THEME_STORAGE_KEY) return;
  apply(event.newValue === "light" ? "light" : "dark");
  notify();
}

export function subscribeTheme(cb: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}
