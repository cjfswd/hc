import type { AppRouter } from '@/trpc/routers/_app';

import { createTRPCContext } from '@trpc/tanstack-react-query';
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();