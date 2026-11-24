const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

// O V8 aceita "2026-02-30" e rola para março; aqui a data tem de existir.
function isRealDate(isoDate: string): boolean {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

// Hora de parede de São Paulo → Date, para testes de tempo (nunca o relógio
// real). O Brasil não tem horário de verão desde 2019, então o offset é fixo
// em -03:00; se isso mudar, esta é a única linha a rever.
export function spDate(isoDate: string, hhmm: string): Date {
  if (!isRealDate(isoDate) || !HH_MM.test(hhmm)) {
    throw new RangeError(`spDate: data ou hora inválida: ${isoDate} ${hhmm}`);
  }
  return new Date(`${isoDate}T${hhmm}:00-03:00`);
}
