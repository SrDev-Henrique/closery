import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Pílula em todo o app (C-V2). O tamanho do texto fica em cada `size` (não na
// base): `buttonVariants` também é usado cru em <Link className={...}>, sem
// twMerge, e duas classes de font-size na mesma string dependeriam da ordem do CSS.
// Pelo mesmo motivo a cor da borda fica em cada variante: `border-transparent`
// em todas menos o `outline` (no CSS gerado ele vem depois do `border-input` e
// apagava a borda do outline num <Link> cru).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        // Borda com o token dos campos (--input) nos dois temas: o --border da
        // paleta nova (9% de tinta) sumia no fundo da página no tema claro e o
        // botão parecia texto solto.
        outline:
          "border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        // Sobre o fundo da página (ex.: "Ver o dashboard"): card, hover accent.
        surface:
          "border-transparent bg-card text-card-foreground hover:bg-accent",
        // Foco nas duas variantes de card colorido: contorno sólido de 2px na
        // tinta `on-pastel` no lugar do anel `ring/50` (invisível no pastel).
        // O `outline-solid` é obrigatório: o `outline-none` da base grava
        // `--tw-outline-style: none` e o `outline-2` usa essa variável. O
        // `ring-0!` apaga o anel da base também no `buttonVariants` cru num
        // <Link> (sem twMerge, o `.ring-3` venceria pela ordem do CSS). Prova
        // pelo estilo calculado: `e2e/inicio.spec.ts`.
        // Primário dentro de card colorido: tinta fixa, afunda ao apertar.
        "on-pastel":
          "border-transparent bg-on-pastel text-on-pastel-ink focus-visible:ring-0! focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-on-pastel active:scale-[.97] [transition-property:background-color,color,scale]",
        // Secundário dentro de card colorido: fundo translúcido sobre o pastel.
        "on-pastel-secondary":
          "border-transparent bg-on-pastel-secondary text-on-pastel hover:bg-on-pastel-secondary-hover focus-visible:ring-0! focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-on-pastel",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 text-sm font-medium max-md:h-11 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-9 gap-1 px-2 text-xs font-medium max-md:h-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-2.5 text-[0.8rem] font-medium max-md:h-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-4 text-sm font-medium has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9 text-sm font-medium max-md:size-11",
        "icon-xs":
          "size-9 text-sm font-medium max-md:size-11 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 text-sm font-medium max-md:size-11",
        "icon-lg": "size-11 text-sm font-medium",
        // 48px, Satoshi 16px/700 (Início e shell). Já acima do alvo de toque.
        // `border-0`: a borda transparente de 1px da base, com o
        // `bg-clip-padding`, deixava o fundo visível com 46px de altura e 2px
        // a mais de largura (protótipo: sem borda). O `.border-0` vem depois do
        // `.border` no CSS, então vence também sem twMerge (Link com a string crua).
        pill: "h-12 gap-2.5 border-0 px-[22px] font-heading text-base font-bold [&_svg:not([class*='size-'])]:size-[18px]",
        // Controle redondo de 44px (botão do menu, etc.), também sem a borda.
        "icon-pill":
          "size-11 border-0 text-sm font-medium [&_svg:not([class*='size-'])]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
