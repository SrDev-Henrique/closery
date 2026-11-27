import { cn } from "cn";

export type UserAvatarSize = 34 | 36 | 44 | 52 | 84;

// Classes inteiras e estáticas (o Tailwind só gera o que aparece escrito).
// Moldura = tamanho cheio (border-box). Padding e raios são os do protótipo
// (Inicio.dc.html), que vence a spec nesses valores finos: 2,5px nos de 34 e
// 36, 3px nos de 44 e 52, 4px no de 84; a imagem acompanha a curva da moldura.
const SIZE_CLASSES: Record<
  UserAvatarSize,
  { frame: string; image: string; inner: number }
> = {
  34: {
    frame: "size-[34px] p-[2.5px] rounded-[11px]",
    image: "rounded-[9px]",
    inner: 29,
  },
  36: {
    frame: "size-[36px] p-[2.5px] rounded-[12px]",
    image: "rounded-[10px]",
    inner: 31,
  },
  44: {
    frame: "size-[44px] p-[3px] rounded-[15px]",
    image: "rounded-[12px]",
    inner: 38,
  },
  52: {
    frame: "size-[52px] p-[3px] rounded-[17px]",
    image: "rounded-[14px]",
    inner: 46,
  },
  84: {
    frame: "size-[84px] p-1 rounded-[26px]",
    image: "rounded-[22px]",
    inner: 76,
  },
};

// Avatar decorativo (alt vazio): o nome da pessoa sempre aparece ao lado.
// `src` é o data URI de `avatarDataUri` (src/lib/avatar.ts), gerado no servidor.
export function UserAvatar({
  src,
  size,
  tilt,
  frame = "default",
  className,
}: {
  src: string;
  size: UserAvatarSize;
  tilt?: number;
  frame?: "default" | "on-pastel";
  className?: string;
}) {
  const sizing = SIZE_CLASSES[size];
  return (
    <div
      className={cn(
        "box-border flex-none",
        sizing.frame,
        frame === "on-pastel" ? "bg-on-pastel" : "bg-frame",
        className,
      )}
      // A inclinação é geometria, não cor: não cabe em token.
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {/* biome-ignore lint/performance/noImgElement: data URI de SVG gerado no servidor; next/image não otimiza SVG nem data URI */}
      <img
        src={src}
        alt=""
        width={sizing.inner}
        height={sizing.inner}
        draggable={false}
        className={cn("block size-full", sizing.image)}
      />
    </div>
  );
}
