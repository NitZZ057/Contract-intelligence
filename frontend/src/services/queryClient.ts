import { QueryClient } from "@tanstack/react-query";
import { toApiError } from "@/utils/errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount: number, error: Error) => {
        const apiError = toApiError(error);
        if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
