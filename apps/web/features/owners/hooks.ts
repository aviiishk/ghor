import { useQuery } from '@tanstack/react-query';
import { getOwner } from './api';
import { ApiError } from '@/lib/apiClient';

export const ownersKeys = {
  detail: (id: string) => ['owners', id] as const,
};

export function useOwner(id: string | undefined) {
  return useQuery({
    queryKey: ownersKeys.detail(id ?? ''),
    queryFn: () => getOwner(id!),
    enabled: !!id,
    // Response stats and ratings move slowly; don't refetch on every listing-detail visit.
    staleTime: 5 * 60 * 1000,
    // A 404 (banned owner, or a seeker with no live listings) won't change on retry.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}
