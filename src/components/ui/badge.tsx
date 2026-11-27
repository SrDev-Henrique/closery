import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Altura, padding horizontal e peso ficam em cada `size` (não na base), para o
// `md` não somar duas alturas quando `badgeVariants` é usado sem twMerge.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent py-0.5 text-xs whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        warning: "bg-warning text-warning-foreground",
        info: "bg-info text-info-foreground",
        success: "bg-success text-success-foreground",
        neutral: "bg-accent text-foreground",
        // Sempre claros nos dois temas: ficam sobre o pastel do cartão de turno.
        "pastel-pending": "bg-pastel-pending text-pastel-pending-foreground",
        "pastel-confirmed":
          "bg-pastel-confirmed text-pastel-confirmed-foreground",
      },
      size: {
        default: "h-5 px-2 font-medium",
        // Sem a borda transparente de 1px da base: o fundo pinta por baixo
        // dela e o selo ficava 2px mais largo que o do protótipo. A altura da
        // linha é a `normal` da fonte, como no protótipo (com a do `text-xs`,
        // o texto subia até 0,8px dentro da pílula). Quem passa outro
        // `text-*` no className repete o `leading-[normal]` depois dele.
        md: "h-6 border-0 px-2.5 leading-[normal] font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
