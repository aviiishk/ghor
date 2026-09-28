// Well-known Guwahati localities — names only, used for search/type-ahead suggestions and
// the landing marquee. This is NOT inventory data: it never implies listings exist in an
// area (real per-area counts come from GET /listings/localities). Add to it freely.
export const GUWAHATI_LOCALITIES = [
  'Beltola',
  'Six Mile',
  'Jalukbari',
  'Hatigaon',
  'Chandmari',
  'Dispur',
  'Ganeshguri',
  'Zoo Road',
  'Panbazar',
  'Paltan Bazaar',
  'Khanapara',
  'Maligaon',
  'Lachit Nagar',
  'Bhangagarh',
  'Adabari',
  'Basistha',
  'Beltola Tiniali',
  'Bhetapara',
  'Birubari',
  'Chandrapur',
  'Christian Basti',
  'Dhirenpara',
  'Fatasil',
  'Gandhibasti',
  'Garchuk',
  'Geetanagar',
  'Hengrabari',
  'Kahilipara',
  'Lokhra',
  'Maligaon Chariali',
  'Narengi',
  'Noonmati',
  'Pandu',
  'Rukminigaon',
  'Silpukhuri',
  'Survey',
  'Ulubari',
  'Uzan Bazar',
  'VIP Road',
] as const;

export function suggestLocalities(query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = GUWAHATI_LOCALITIES.filter((l) => l.toLowerCase().startsWith(q));
  const contains = GUWAHATI_LOCALITIES.filter((l) => !l.toLowerCase().startsWith(q) && l.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}
