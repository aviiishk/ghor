import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export function usePendingListings() {
  return useQuery({ queryKey: ['admin', 'listings', 'pending'], queryFn: api.getPendingListings });
}

export function useBulkSetListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, reason }: { ids: string[]; status: 'approved' | 'rejected'; reason: string }) =>
      api.bulkSetListingStatus(ids, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'listings', 'pending'] }),
  });
}

export function useOpenReports() {
  return useQuery({ queryKey: ['admin', 'reports'], queryFn: api.getOpenReports });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'dismiss' | 'confirm' }) =>
      api.resolveReport(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'listings', 'pending'] });
    },
  });
}

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: api.getUsers });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'seeker' | 'owner' }) =>
      api.setUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useAppConfig() {
  return useQuery({ queryKey: ['admin', 'config'], queryFn: api.getConfig });
}

export function useAdminAnalytics() {
  return useQuery({ queryKey: ['admin', 'analytics'], queryFn: api.getAnalytics });
}
