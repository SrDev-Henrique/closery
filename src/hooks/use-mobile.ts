import * as React from "react";

// Celular é abaixo de 860px (C-V3). Mesmo número do `--breakpoint-md` (53,75rem) do globals.css;
// o guarda src/app/themeContrast.test.ts confere os dois.
const MOBILE_BREAKPOINT = 860;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
