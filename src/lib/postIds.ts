/** IDs estáveis alinhados ao PostgreSQL (`post_day1` … `post_day30` + extras por dia). */
export function stablePlannedPostId(dayNum: number, slotInDay = 0): string {
  return slotInDay === 0 ? `post_day${dayNum}` : `post_day${dayNum}_p${slotInDay}`;
}
