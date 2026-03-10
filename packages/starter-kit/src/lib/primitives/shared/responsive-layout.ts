export function responsiveGridColumns(columns: number, minWidth = 240) {
  if (columns <= 1) {
    return 'minmax(0, 1fr)';
  }

  return `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`;
}
