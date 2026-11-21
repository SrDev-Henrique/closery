import { describe, expect, it } from "vitest";

import {
  crossesMidnight,
  findOverlaps,
  formatOverlapWarning,
  type NamedShiftRange,
  rangesOverlap,
  shiftSegments,
  suggestShiftName,
  suggestShiftTimes,
} from "@/features/admin/shiftRules";

function range(startsAt: string, endsAt: string) {
  return { startsAt, endsAt };
}

describe("crossesMidnight", () => {
  it("é verdadeiro quando o fim é menor que o início", () => {
    expect(crossesMidnight(range("22:00", "06:00"))).toBe(true);
    expect(crossesMidnight(range("23:59", "00:00"))).toBe(true);
  });

  it("é falso no mesmo dia", () => {
    expect(crossesMidnight(range("06:00", "14:00"))).toBe(false);
    expect(crossesMidnight(range("00:00", "23:59"))).toBe(false);
  });

  it("lança RangeError para horário inválido", () => {
    expect(() => crossesMidnight(range("25:00", "06:00"))).toThrow(RangeError);
  });
});

describe("shiftSegments", () => {
  it("um segmento no mesmo dia", () => {
    expect(shiftSegments(range("06:00", "14:00"))).toEqual([[360, 840]]);
  });

  it("dois segmentos ao atravessar a meia-noite", () => {
    expect(shiftSegments(range("22:00", "06:00"))).toEqual([
      [1320, 1440],
      [0, 360],
    ]);
  });

  it("termina exatamente à meia-noite: um segmento só, sem segmento vazio", () => {
    expect(shiftSegments(range("22:00", "00:00"))).toEqual([[1320, 1440]]);
  });

  it("início == fim não tem duração: nenhum segmento", () => {
    expect(shiftSegments(range("06:00", "06:00"))).toEqual([]);
  });
});

describe("rangesOverlap", () => {
  it("22:00–06:00 e 05:00–07:00 sobrepõem (meia-noite)", () => {
    expect(
      rangesOverlap(range("22:00", "06:00"), range("05:00", "07:00")),
    ).toBe(true);
  });

  it("23:00–01:00 e 00:00–02:00 sobrepõem, nos dois sentidos", () => {
    expect(
      rangesOverlap(range("23:00", "01:00"), range("00:00", "02:00")),
    ).toBe(true);
    expect(
      rangesOverlap(range("00:00", "02:00"), range("23:00", "01:00")),
    ).toBe(true);
  });

  it("encostar não sobrepõe: 06:00–14:00 e 14:00–22:00", () => {
    expect(
      rangesOverlap(range("06:00", "14:00"), range("14:00", "22:00")),
    ).toBe(false);
    expect(
      rangesOverlap(range("14:00", "22:00"), range("06:00", "14:00")),
    ).toBe(false);
  });

  it("encostar na meia-noite não sobrepõe: 22:00–06:00 e 06:00–14:00", () => {
    expect(
      rangesOverlap(range("22:00", "06:00"), range("06:00", "14:00")),
    ).toBe(false);
  });

  it("um minuto de sobreposição conta", () => {
    expect(
      rangesOverlap(range("06:00", "14:01"), range("14:00", "22:00")),
    ).toBe(true);
  });

  it("um dentro do outro sobrepõe", () => {
    expect(
      rangesOverlap(range("06:00", "22:00"), range("10:00", "12:00")),
    ).toBe(true);
  });

  it("intervalos separados não sobrepõem", () => {
    expect(
      rangesOverlap(range("06:00", "10:00"), range("12:00", "14:00")),
    ).toBe(false);
  });

  it("22:00–00:00 não sobrepõe 00:00–06:00", () => {
    expect(
      rangesOverlap(range("22:00", "00:00"), range("00:00", "06:00")),
    ).toBe(false);
  });
});

describe("findOverlaps", () => {
  const manha: NamedShiftRange = {
    id: "a",
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  };
  const tarde: NamedShiftRange = {
    id: "b",
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
  };
  const noite: NamedShiftRange = {
    id: "c",
    name: "Noite",
    startsAt: "22:00",
    endsAt: "06:00",
  };

  it("devolve vazio sem outros turnos", () => {
    expect(findOverlaps(range("06:00", "14:00"), [])).toEqual([]);
  });

  it("devolve vazio quando os turnos só se encostam", () => {
    expect(findOverlaps(range("06:00", "14:00"), [tarde, noite])).toEqual([]);
  });

  it("devolve o aviso com o turno que sobrepõe, na ordem de entrada", () => {
    expect(
      findOverlaps(range("13:00", "23:00"), [noite, manha, tarde]),
    ).toEqual([
      { shiftId: "c", name: "Noite", startsAt: "22:00", endsAt: "06:00" },
      { shiftId: "a", name: "Manhã", startsAt: "06:00", endsAt: "14:00" },
      { shiftId: "b", name: "Tarde", startsAt: "14:00", endsAt: "22:00" },
    ]);
  });

  it("ignora o próprio turno ao editar (mesmo id)", () => {
    expect(
      findOverlaps({ id: "a", ...range("07:00", "15:00") }, [manha, tarde]),
    ).toEqual([
      { shiftId: "b", name: "Tarde", startsAt: "14:00", endsAt: "22:00" },
    ]);
  });

  it("sem id no candidato, nenhum turno é ignorado", () => {
    expect(findOverlaps(range("06:00", "14:00"), [manha])).toHaveLength(1);
  });

  it("pega a sobreposição pela meia-noite", () => {
    expect(
      findOverlaps(range("05:00", "07:00"), [manha, tarde, noite]).map(
        (warning) => warning.name,
      ),
    ).toEqual(["Manhã", "Noite"]);
  });
});

describe("formatOverlapWarning", () => {
  it("usa travessão curto entre os horários", () => {
    expect(
      formatOverlapWarning({
        shiftId: "a",
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      }),
    ).toBe("Sobrepõe o turno Manhã (06:00\u{2013}14:00)");
  });
});

describe("suggestShiftTimes", () => {
  it("sem turnos: 06:00 às 14:00", () => {
    expect(suggestShiftTimes([])).toEqual(range("06:00", "14:00"));
  });

  it("começa onde o último termina e dura 8 h", () => {
    expect(
      suggestShiftTimes([range("06:00", "14:00"), range("14:00", "22:00")]),
    ).toEqual(range("22:00", "06:00"));
  });

  it("usa o último da lista recebida, não o maior horário", () => {
    expect(
      suggestShiftTimes([range("14:00", "22:00"), range("06:00", "10:00")]),
    ).toEqual(range("10:00", "18:00"));
  });

  it("passa da meia-noite com módulo 24 h", () => {
    expect(suggestShiftTimes([range("20:00", "23:00")])).toEqual(
      range("23:00", "07:00"),
    );
  });

  it("último termina à meia-noite: próximo começa 00:00", () => {
    expect(suggestShiftTimes([range("16:00", "00:00")])).toEqual(
      range("00:00", "08:00"),
    );
  });
});

describe("suggestShiftName", () => {
  it("sem turnos: Turno 1", () => {
    expect(suggestShiftName([])).toBe("Turno 1");
  });

  it("quantidade + 1", () => {
    expect(suggestShiftName(["Manhã", "Tarde"])).toBe("Turno 3");
  });

  it("sobe enquanto o nome existir, sem diferença de caixa", () => {
    expect(suggestShiftName(["Turno 2", "Manhã"])).toBe("Turno 3");
    expect(suggestShiftName(["turno 3", "TURNO 4", "Manhã"])).toBe("Turno 5");
  });
});
