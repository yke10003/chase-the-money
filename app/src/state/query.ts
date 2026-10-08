import { QueryClient, useQueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function useRefreshProduct() {
  const client = useQueryClient();

  return async () => {
    await client.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];

        return key === 'home' || key === 'opportunities' || key === 'opportunity' || key === 'progress' || key === 'goal' || key === 'discover' || key === 'profile' || key === 'sell';
      },
    });
  };
}
