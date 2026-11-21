/** "1 pessoa", "0 pessoas", "3 pessoas": só o 1 usa o singular. */
export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
