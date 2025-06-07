"use client";
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/utils/trpc';
export function Users() {
    const trpc = useTRPC();
    const greetingQuery = useQuery(trpc.hello.queryOptions({ text: 'Jerry' }));
    // greetingQuery.data === 'Hello Jerry'
    return (<div>
        {greetingQuery.data ? (
            <p>{greetingQuery.data.greeting}</p>
        ) : (
            <p>Loading...</p>
        )}
    </div>)
}