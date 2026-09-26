import { apiRequest } from '@/lib/apiClient';

export type Institution = {
  id: string;
  name: string;
  type: 'school' | 'college' | 'university';
  city: string;
};

// Table is empty in ghor-dev right now (no seed data yet, apps/api/STATUS.md) — this
// will correctly return [] until the founder provides a Guwahati institutions list.
export async function searchInstitutions(search?: string): Promise<Institution[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<Institution[]>(`/institutions${qs}`, { auth: true });
}
