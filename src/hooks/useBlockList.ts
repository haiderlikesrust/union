'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserBlock } from '@/lib/types';

export function useBlockList() {
    const { pb, user } = useAuth();
    const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!user) {
            setBlockedIds(new Set());
            setLoading(false);
            return;
        }
        try {
            const list = await pb.collection('user_blocks').getFullList({
                filter: `blocker = "${user.id}"`,
            });
            const ids = new Set((list as unknown as UserBlock[]).map(b => b.blocked));
            setBlockedIds(ids);
        } catch {
            setBlockedIds(new Set());
        } finally {
            setLoading(false);
        }
    }, [pb, user]);

    useEffect(() => {
        load();
    }, [load]);

    const blockUser = useCallback(async (userId: string) => {
        if (!user || userId === user.id) return;
        try {
            await pb.collection('user_blocks').create({
                blocker: user.id,
                blocked: userId,
            });
            setBlockedIds(prev => new Set([...prev, userId]));
        } catch (e) {
            console.error(e);
            throw e;
        }
    }, [pb, user]);

    const unblockUser = useCallback(async (userId: string) => {
        if (!user) return;
        try {
            const list = await pb.collection('user_blocks').getList(1, 1, {
                filter: `blocker = "${user.id}" && blocked = "${userId}"`,
            });
            if (list.items.length > 0) {
                await pb.collection('user_blocks').delete(list.items[0].id);
            }
            setBlockedIds(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        } catch (e) {
            console.error(e);
            throw e;
        }
    }, [pb, user]);

    const isBlocked = useCallback((userId: string) => blockedIds.has(userId), [blockedIds]);

    return { blockedIds, blockUser, unblockUser, isBlocked, loading, refresh: load };
}
