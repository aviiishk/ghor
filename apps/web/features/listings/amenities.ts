// Single source for the amenity flags a listing can carry (stored as keys in
// listings.amenities jsonb) — used by the create/edit forms, cards, detail, and the
// browse Filters panel. Root CLAUDE.md §12: keep this list short (6–8).
export const AMENITIES = ['wifi', 'parking', 'attached_bath', 'furnished', 'water_24x7', 'lift'] as const;

const LABELS: Record<string, string> = {
  wifi: 'Wi-Fi',
  parking: 'Parking',
  attached_bath: 'Attached bath',
  furnished: 'Furnished',
  water_24x7: '24×7 water',
  lift: 'Lift',
};

// Falls back to a readable version of unknown keys (older rows, future additions).
export function amenityLabel(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ');
}
