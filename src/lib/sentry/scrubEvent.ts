import type { ErrorEvent } from "@sentry/nextjs";

// Função pura, sem import de runtime: roda no servidor e no navegador. Última
// barreira antes do envio ao Sentry (LGPD: o serviço fica fora do país). O
// evento sai só com tipo do erro, mensagem já higienizada, pilha, rota e
// ambiente; nada de pessoa, IP, cookie, cabeçalho, corpo ou query string.
// Só limpa os padrões conhecidos abaixo (P69): o que escapar deles sai.

export const REDACTED = "[removido]";

// O erro do Drizzle carrega no `message` o SQL e os parâmetros inteiros
// ("Failed query: ... params: ..."), com e-mail, hash de token, texto da
// passagem. Tudo do `Failed query:` em diante é descartado.
const FAILED_QUERY = /Failed query:[\s\S]*/g;
// Mensagem reembrulhada por outra camada: só os parâmetros chegam.
const PARAMS = /params:[\s\S]*/g;
// O Postgres repete o valor que recusou: `invalid input syntax for type uuid: "x"`.
const INVALID_INPUT =
  /(invalid input (?:syntax|value) for (?:type|enum) [^\s:]+: )"[^"]*"/g;
// O token do convite e do link de redefinição vai no caminho da URL.
const TOKEN_PATH = /\/(convite|redefinir-senha)\/[^/?#\s"']+/g;
// ...e o do link de redefinição, no fragmento (`#token=`).
const TOKEN_FRAGMENT = /#token=[^\s"']*/g;
const QUERY = /\?[^\s"']+/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// A ordem importa: o SQL e os parâmetros saem antes de qualquer outro padrão.
export function scrubText(text: string): string {
  return text
    .replace(FAILED_QUERY, `Failed query: ${REDACTED}`)
    .replace(PARAMS, `params: ${REDACTED}`)
    .replace(INVALID_INPUT, `$1"${REDACTED}"`)
    .replace(TOKEN_PATH, `/$1/${REDACTED}`)
    .replace(TOKEN_FRAGMENT, `#token=${REDACTED}`)
    .replace(QUERY, "")
    .replace(EMAIL, REDACTED);
}

type ExceptionValue = NonNullable<
  NonNullable<ErrorEvent["exception"]>["values"]
>[number];

type Frame = NonNullable<
  NonNullable<ExceptionValue["stacktrace"]>["frames"]
>[number];

// Num script embutido do navegador o frame carrega a URL da página (com
// `?query`, `/convite/<token>` ou `#token=`): os três campos de caminho passam
// pelo mesmo scrubText.
function scrubFrame(frame: Frame): Frame {
  const scrubbed: Frame = { ...frame };
  if (frame.filename !== undefined) {
    scrubbed.filename = scrubText(frame.filename);
  }
  if (frame.abs_path !== undefined) {
    scrubbed.abs_path = scrubText(frame.abs_path);
  }
  if (frame.module !== undefined) scrubbed.module = scrubText(frame.module);
  return scrubbed;
}

// Uma exceção (a principal e cada causa que o linkedErrors junta): o texto
// higienizado, sem os dados do mecanismo e sem as variáveis locais da pilha.
function scrubException(value: ExceptionValue): ExceptionValue {
  const { mechanism, stacktrace, ...rest } = value;
  const scrubbed: ExceptionValue = { ...rest };
  if (value.value !== undefined) scrubbed.value = scrubText(value.value);
  if (mechanism) {
    const { data: _data, ...safeMechanism } = mechanism;
    scrubbed.mechanism = safeMechanism;
  }
  if (stacktrace) {
    scrubbed.stacktrace = {
      ...stacktrace,
      frames: stacktrace.frames?.map(({ vars: _vars, ...frame }) =>
        scrubFrame(frame),
      ),
    };
  }
  return scrubbed;
}

// Cópia rasa: tudo o que muda é refeito (sdk, exception, mecanismo, frames),
// nunca alterado no objeto original.
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  const scrubbed: T = { ...event };

  delete scrubbed.user;
  delete scrubbed.request;
  delete scrubbed.server_name;
  delete scrubbed.breadcrumbs;
  delete scrubbed.extra;
  delete scrubbed.logentry;

  if (scrubbed.sdk) {
    // O cliente do navegador põe `sdk.settings.infer_ip` ("auto" se houver
    // usuário) e o core o mescla de volta depois do beforeSend; apagar a chave
    // não adianta e, sem ela, o Relay inferiria o IP: força "never".
    const { settings: _settings, ...sdk } = scrubbed.sdk;
    scrubbed.sdk = { ...sdk, settings: { infer_ip: "never" } };
  }

  if (scrubbed.message) scrubbed.message = scrubText(scrubbed.message);
  if (scrubbed.transaction) {
    scrubbed.transaction = scrubText(scrubbed.transaction);
  }

  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map(scrubException),
    };
  }

  // Só o que ajuda a achar o erro; contextos de dispositivo, SO, culture etc.
  // e tags com URL ficam de fora; o valor das demais tags passa pelo scrubText.
  scrubbed.contexts = scrubbed.contexts?.trace
    ? { trace: scrubbed.contexts.trace }
    : {};
  if (scrubbed.tags) {
    scrubbed.tags = Object.fromEntries(
      Object.entries(scrubbed.tags)
        .filter(([key]) => !key.toLowerCase().includes("url"))
        .map(([key, value]) => [
          key,
          typeof value === "string" ? scrubText(value) : value,
        ]),
    );
  }

  return scrubbed;
}
