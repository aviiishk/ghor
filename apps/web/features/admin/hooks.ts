import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export function usePendingListings() {
  return useQuery({ queryKey: ['admin', 'listings', 'pending'], queryFn: api.getPendingListings });
}

export function useBulkSetListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: 'approved' | 'rejected' }) =>
      api.bulkSetListingStatus(ids, status),
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

export function useSetUserBanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) => api.setUserBanned(id, banned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'seeker' | 'owner' | 'admin' }) =>
      api.setUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useAppConfig() {
  return useQuery({ queryKey: ['admin', 'config'], queryFn: api.getConfig });
}

export function useSetConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api.setConfig(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'config'] }),
  });
}

export function useAdminAnalytics() {
  return useQuery({ queryKey: ['admin', 'analytics'], queryFn: api.getAnalytics });
}
