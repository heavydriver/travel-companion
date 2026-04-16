/** Stable accent per category slug for pins (bright, high-contrast on map). */
export function pinColorForCategory(category: string): string {
  const key = category.trim().toLowerCase();
  const palette = [
    "#3B82F6",
    "#22D3EE",
    "#A855F7",
    "#F43F5E",
    "#FBBF24",
    "#34D399",
    "#FB923C",
    "#E879F9",
  ];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length] ?? "#3B82F6";
}
