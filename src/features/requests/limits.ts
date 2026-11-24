// Constantes das solicitações. Sem I/O: o cliente também importa daqui.
export const STALE_AFTER_DAYS = 3;
export const DAY_MS = 86_400_000;
export const STALE_AFTER_MS = STALE_AFTER_DAYS * DAY_MS; // 72 h, sem fuso
export const BOARD_PAGE_SIZE = 20; // linhas por coluna/grupo e passo do "Carregar mais"
export const BOARD_MAX_LIMIT = 200; // teto de ?mais_<status>=
export const CLOSED_WINDOW_DAYS = 30; // Entregue e Cancelada no Quadro/Lista sem período escolhido
export const DESCRIPTION_MAX_LENGTH = 500; // pontos de código
export const DESTINATION_OTHER_MAX_LENGTH = 80;
export const COMMENT_MAX_LENGTH = 2000;
export const CANCEL_REASON_MAX_LENGTH = 500;
export const REQUEST_ITEMS_MAX = 50;
export const REQUEST_ITEM_MIN_QUANTITY = 1; // o teto é MAX_QUANTITY (99.999) de features/handovers/limits
export const SEARCH_MAX_LENGTH = 80;
export const HOME_STALE_LIMIT = 5;
export const HANDOVER_OPEN_LIMIT = 20; // seções "Solicitações abertas" da passagem
export const COMMENTS_PAGE_SIZE = 50;
export const COMMENTS_MAX_LIMIT = 500;
export const TIMELINE_LIMIT = 200; // teto da linha do tempo (os mais recentes)
export const PREVIEW_LENGTH = 60; // prévia da descrição em toasts e rótulos
export const DESTINATION_OTHER = "outro"; // valor do <select> de destino e de ?destino=
