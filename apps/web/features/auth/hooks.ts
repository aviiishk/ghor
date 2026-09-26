import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from './api';

export const profileKey = ['profile'];

export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: getProfile, retry: false });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => qc.setQueryData(profileKey, profile),
  });
}
