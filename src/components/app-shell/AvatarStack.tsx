import { cn } from "cn";

import { UserAvatar, type UserAvatarSize } from "./UserAvatar";

export type StackedAvatar = {
  // Chave React: estável e única na pilha (o papel da pessoa ou o id dela).
  id: string;
  // Data URI de `avatarDataUri(userId)` (src/lib/avatar.ts), gerado no servidor.
  src: string;
  // Inclinação em graus; sem ela, o avatar fica reto.
  tilt?: number;
};

// Avatares sobrepostos numa linha de texto (pack de correção do Início, spec
// §6.4.1). Na ordem recebida: o primeiro fica por cima de todos (`relative
// z-1`, o `z-index: 1` do protótipo) e cada um depois dele entra 8px por baixo
// do anterior (`-ml-2`). Decorativo como o `UserAvatar`: o nome das pessoas
// está no texto ao lado. Lista vazia não desenha nada.
export function AvatarStack({
  avatars,
  size,
  frame = "default",
  className,
}: {
  avatars: readonly StackedAvatar[];
  size: UserAvatarSize;
  frame?: "default" | "on-pastel";
  className?: string;
}) {
  if (avatars.length === 0) return null;
  return (
    <div
      data-slot="avatar-stack"
      className={cn("flex flex-none items-center", className)}
    >
      {avatars.map((avatar, index) => (
        <UserAvatar
          key={avatar.id}
          src={avatar.src}
          size={size}
          tilt={avatar.tilt}
          frame={frame}
          className={index === 0 ? "relative z-1" : "-ml-2"}
        />
      ))}
    </div>
  );
}
