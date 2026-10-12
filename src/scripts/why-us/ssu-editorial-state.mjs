export function cursorOffset(x, y) {
  const clamp = value => Math.max(0, Math.min(1, value));
  return { x: (clamp(x) - .5) * 4, y: (clamp(y) - .5) * 4 };
}
export function selection(key) {
  const values = {
    low: { height: 950, label: 'Низкое ССУ · ≈ 950 мм' },
    medium: { height: 1150, label: 'Среднее ССУ · ≈ 1150 мм' },
    high: { height: 1500, label: 'Высокое ССУ · ≈ 1500 мм' },
  };
  if (!Object.hasOwn(values, key)) throw new RangeError('Неизвестная высота ССУ');
  return values[key];
}
