ALTER TABLE "sector" ADD COLUMN "color" text;--> statement-breakpoint
UPDATE "sector" SET "color" = (ARRAY['lilac', 'peach', 'sky', 'green', 'pink'])[(((ordered."position" - 1) % 5) + 1)::int]
FROM (
	SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "position" FROM "sector"
) AS ordered
WHERE "sector"."id" = ordered."id";--> statement-breakpoint
ALTER TABLE "sector" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sector" ADD CONSTRAINT "sector_color_valid" CHECK ("sector"."color" in ('lilac', 'peach', 'sky', 'green', 'pink'));
-- Editada à mão depois do db:generate: o SQL gerado adicionava a coluna NOT NULL de uma vez, o que falha
-- com setores já cadastrados. Passos: (1) coluna anulável; (2) preenchimento ÚNICO pela ordem de
-- created_at (desempate por id), ciclando a paleta: o único lugar em que a cor vem da ordem, depois disso
-- a cor é do setor; (3) NOT NULL; (4) check da paleta. O estado final é o do schema (NOT NULL + check),
-- então drizzle/meta/0005_snapshot.json (gerado do schema) continua correto sem edição.
