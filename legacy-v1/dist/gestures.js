// Use the same target for the highlight and release. On touchscreens the
// card can reach the pile before the finger gripping its bottom corner does.
export function cardOverPile(point, card, pile) {
  const gutter = 24;
  if (point.x >= pile.left - gutter && point.x <= pile.right + gutter &&
      point.y >= pile.top - gutter && point.y <= pile.bottom + gutter) return true;
  if (!card || !card.width || !card.height) return false;
  const width = Math.max(0, Math.min(card.right, pile.right) - Math.max(card.left, pile.left));
  const height = Math.max(0, Math.min(card.bottom, pile.bottom) - Math.max(card.top, pile.top));
  return width * height >= Math.min(card.width * card.height, pile.width * pile.height) * .3;
}
