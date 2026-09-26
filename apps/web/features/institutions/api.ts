import { apiRequest } from '@/lib/apiClient';

export type Institution = {
  id: string;
  name: string;
  type: 'school' | 'college' | 'university';
  city: string;
};

// Table is empty in ghor-dev right now (no seed data yet) — this correctly returns []
// until the founder provides a Guwahati institutions list. See root STATUS.md.
export async function searchInstitutions(search?: string): Promise<Institution[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<Institution[]>(`/institutions${qs}`);
}
