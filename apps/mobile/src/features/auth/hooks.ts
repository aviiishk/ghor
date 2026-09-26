// Fixes a gap flagged in STATUS.md since the auth rewrite: api.ts had no hooks.ts wrapper,
// violating root CLAUDE.md §14.2. Added now because the role-conditional tab bar and the
// listing-detail "is this my listing" check both need the current profile.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from './api';

export const profileKey = ['profile'] as const;

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
