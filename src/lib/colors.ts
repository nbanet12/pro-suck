export const PERSON_COLORS = [
  "#C24A2A",
  "#2F5EA8",
  "#2F7A5A",
  "#7A4AA8",
  "#C4891A",
  "#1A8A86",
  "#B04A6E",
  "#4A5C8A",
];

export function personColor(index: number) {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}
