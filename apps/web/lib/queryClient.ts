import { QueryClient } from '@tanstack/react-query';

// Same defaults as apps/mobile/src/lib/queryClient.ts — keep the two in sync.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
