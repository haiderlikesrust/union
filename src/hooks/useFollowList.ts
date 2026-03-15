'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserFollow } from '@/lib/types';

export function useFollowList() {
    const { pb, user } = useAuth();
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!user) {
            setFollowingIds(new Set());
            setLoading(false);
            return;
        }
        try {
            const list = await pb.collection('user_follows').getFullList({
                filter: `follower = "${user.id}"`,
            });
            const ids = new Set((list as unknown as UserFollow[]).map(f => f.following));
            setFollowingIds(ids);
        } catch {
            setFollowingIds(new Set());
        } finally {
            setLoading(false);
        }
    }, [pb, user]);

    useEffect(() => {
        load();
    }, [load]);

    const followUser = useCallback(async (userId: string) => {
        if (!user || userId === user.id) return;
        try {
            await pb.collection('user_follows').create({
                follower: user.id,
                following: userId,
            });
            setFollowingIds(prev => new Set([...prev, userId]));
        } catch (e) {
            console.error(e);
            throw e;
        }
    }, [pb, user]);

    const unfollowUser = useCallback(async (userId: string) => {
        if (!user) return;
        try {
            const list = await pb.collection('user_follows').getList(1, 1, {
                filter: `follower = "${user.id}" && following = "${userId}"`,
            });
            if (list.items.length > 0) {
                await pb.collection('user_follows').delete(list.items[0].id);
            }
            setFollowingIds(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        } catch (e) {
            console.error(e);
            throw e;
        }
    }, [pb, user]);

    const isFollowing = useCallback((userId: string) => followingIds.has(userId), [followingIds]);

    return { followingIds, followUser, unfollowUser, isFollowing, loading, refresh: load };
}
