// Identical query logic to apps/mobile/src/features/listings/hooks.ts — TanStack Query
// usage doesn't differ across React Native/web, only the underlying api.ts transport does.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { BrowseFilters, CreateListingInput, UpdateListingInput } from './api';

export const listingsKeys = {
  browse: (filters: BrowseFilters) => ['listings', 'browse', filters] as const,
  mine: ['listings', 'mine'] as const,
  detail: (id: string) => ['listings', 'detail', id] as const,
  similar: (id: string) => ['listings', 'similar', id] as const,
  insights: (id: string) => ['listings', 'insights', id] as const,
  map: (filters: BrowseFilters) => ['listings', 'map', filters] as const,
};

export function useBrowseListings(filters: BrowseFilters) {
  return useInfiniteQuery({
    queryKey: listingsKeys.browse(filters),
    queryFn: ({ pageParam }) => api.browseListings({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useMyListings() {
  return useQuery({ queryKey: listingsKeys.mine, queryFn: api.getMyListings });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: listingsKeys.detail(id),
    queryFn: () => api.getListing(id),
    enabled: !!id,
  });
}

export function useMapPins(filters: BrowseFilters, enabled: boolean) {
  return useQuery({
    queryKey: listingsKeys.map(filters),
    queryFn: () => api.getMapPins(filters),
    enabled,
  });
}

export function useListingInsights(id: string, enabled: boolean) {
  return useQuery({
    queryKey: listingsKeys.insights(id),
    queryFn: () => api.getListingInsights(id),
    enabled: enabled && !!id,
  });
}

export function useSimilarListings(id: string) {
  return useQuery({
    queryKey: listingsKeys.similar(id),
    queryFn: () => api.getSimilarListings(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateListing(id?: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: listingsKeys.mine });
    qc.invalidateQueries({ queryKey: ['listings', 'browse'] });
    if (id) qc.invalidateQueries({ queryKey: listingsKeys.detail(id) });
  };
}

export function useCreateListing() {
  const invalidate = useInvalidateListing();
  return useMutation({
    mutationFn: (input: CreateListingInput) => api.createListing(input),
    onSuccess: invalidate,
  });
}

export function useUpdateListing(id: string) {
  const invalidate = useInvalidateListing(id);
  return useMutation({
    mutationFn: (input: UpdateListingInput) => api.updateListing(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteListing() {
  const invalidate = useInvalidateListing();
  return useMutation({
    mutationFn: (id: string) => api.deleteListing(id),
    onSuccess: invalidate,
  });
}
