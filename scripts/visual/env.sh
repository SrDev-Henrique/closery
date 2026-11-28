# Ambiente do processo visual (spec §5.3): banco PGlite na 54332 e app na 3202.
# Use com ". scripts/visual/env.sh" de dentro do repositório (ou de uma worktree), antes do
# "bun run build" e do "bunx next start -H localhost -p 3202" (o -H deixa o app fora da rede local).
# Os valores exportados vencem o .env.local.
# O segredo do Better Auth fica fora do git, em <git-common-dir>/sdd/visual-db/secret: é gerado
# na primeira vez (32 bytes, base64) e nunca é impresso.
VISUAL_GIT_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ -z "$VISUAL_GIT_DIR" ]; then
  echo "env.sh: rode dentro do repositório (o git não achou o diretório do repositório)" >&2
  unset VISUAL_GIT_DIR
  return 1 2>/dev/null || exit 1
fi
VISUAL_SECRET_FILE="$VISUAL_GIT_DIR/sdd/visual-db/secret"
if [ ! -s "$VISUAL_SECRET_FILE" ]; then
  mkdir -p "$VISUAL_GIT_DIR/sdd/visual-db"
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))' >"$VISUAL_SECRET_FILE"
fi
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54332/postgres"
export DATABASE_URL_POOLED="$DATABASE_URL"
export DATABASE_POOL_MAX="1"
export BETTER_AUTH_URL="http://localhost:3202"
BETTER_AUTH_SECRET="$(cat "$VISUAL_SECRET_FILE")"
export BETTER_AUTH_SECRET
export GOOGLE_CLIENT_ID="" GOOGLE_CLIENT_SECRET="" FACEBOOK_CLIENT_ID="" FACEBOOK_CLIENT_SECRET=""
export NEXT_PUBLIC_SENTRY_DSN="" SENTRY_AUTH_TOKEN=""
unset VISUAL_GIT_DIR VISUAL_SECRET_FILE
