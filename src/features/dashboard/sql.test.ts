import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  chronologyOrderSql,
  DELIVERED_HANDOVER_SQL,
  handoverScopeSql,
} from "./sql";

const dialect = new PgDialect();
const render = (fragment: SQL) => dialect.sqlToQuery(fragment);
const SECTOR = "11111111-1111-4111-8111-111111111111";

describe("handoverScopeSql", () => {
  it("todos os setores: só o setor ativo, sem parâmetro", () => {
    expect(render(handoverScopeSql({ kind: "all" }))).toMatchObject({
      sql: "(sec.active and true)",
      params: [],
    });
  });

  it("um setor: o id vai como parâmetro, nunca no texto", () => {
    expect(
      render(handoverScopeSql({ kind: "sector", sectorId: SECTOR })),
    ).toMatchObject({
      sql: "(sec.active and h.sector_id = $1)",
      params: [SECTOR],
    });
  });

  it("um id com aspas e ponto e vírgula continua só parâmetro", () => {
    const hostile = "x'; drop table handover; --";
    const query = render(
      handoverScopeSql({ kind: "sector", sectorId: hostile }),
    );
    expect(query.sql).not.toContain("drop");
    expect(query.params).toEqual([hostile]);
  });
});

describe("DELIVERED_HANDOVER_SQL", () => {
  it("entregue é delivered ou confirmed, nunca rascunho", () => {
    expect(render(DELIVERED_HANDOVER_SQL).sql).toBe(
      "h.status in ('delivered', 'confirmed')",
    );
  });
});

describe("chronologyOrderSql", () => {
  it("do mais recente: dia, fim do turno, entrega e id, todos decrescentes", () => {
    const { sql, params } = render(chronologyOrderSql());
    expect(params).toEqual([]);
    expect(sql.replace(/\s+/g, " ")).toBe(
      "h.operational_date desc, ((h.operational_date + (case when s.ends_at < s.starts_at then 1 else 0 end)) + s.ends_at) desc, h.delivered_at desc, h.id desc",
    );
  });
});
