import { useQuery } from '@tanstack/react-query';
import { searchInstitutions } from './api';

export function useInstitutions(search: string) {
  return useQuery({
    queryKey: ['institutions', search],
    queryFn: () => searchInstitutions(search),
  });
}
