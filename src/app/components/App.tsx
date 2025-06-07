"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
// Import or define AppRouter
import type { AppRouter } from '@/trpc/routers/_app'; // Adjust the path as necessary
import { TRPCProvider } from '@/utils/trpc';
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // With SSR, we usually want to set some default staleTime
                // above 0 to avoid refetching immediately on the client
                staleTime: 60 * 1000,
            },
        },
    });
}
let browserQueryClient: QueryClient | undefined = undefined;
function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always make a new query client
        return makeQueryClient();
    } else {
        // Browser: make a new query client if we don't already have one
        // This is very important, so we don't re-make a new client if React
        // suspends during the initial render. This may not be needed if we
        // have a suspense boundary BELOW the creation of the query client
        if (!browserQueryClient) browserQueryClient = makeQueryClient();
        return browserQueryClient;
    }
}
export function App({ children }: { children?: React.ReactNode }) {
    const queryClient = getQueryClient();
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [
                httpBatchLink({
                    url: process.env.NODE_ENV == 'production' ? process.env.NEXT_PUBLIC_BASE_URL + '/api/trpc' : 'http://localhost:3000/api/trpc', // Adjust the URL as necessary
                    // Use superjson or any other transformer if needed
                    transformer: superjson
                }),
            ],
        }),
    );
    return (
        <QueryClientProvider client={queryClient}>
            <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
                {children}
            </TRPCProvider>
        </QueryClientProvider>
    );
}