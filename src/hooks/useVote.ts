'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

interface UseVoteOptions {
    collection: 'post_votes' | 'comment_votes';
    targetField: 'post' | 'comment';
    targetId: string;
    initialScore: number;
    initialVote: number; // 1, -1, or 0
}

export function useVote({ collection, targetField, targetId, initialScore, initialVote }: UseVoteOptions) {
    const { pb, user } = useAuth();
    const [score, setScore] = useState(initialScore);
    const [currentVote, setCurrentVote] = useState(initialVote);
    const [isLoading, setIsLoading] = useState(false);

    const vote = useCallback(async (value: 1 | -1) => {
        if (!user) {
            toast.error('You need to log in to vote');
            return;
        }
        if (isLoading) return;

        setIsLoading(true);
        const prevScore = score;
        const prevVote = currentVote;

        // Optimistic update
        if (currentVote === value) {
            // Removing vote
            setCurrentVote(0);
            setScore(score - value);
        } else if (currentVote === 0) {
            // New vote
            setCurrentVote(value);
            setScore(score + value);
        } else {
            // Switching vote
            setCurrentVote(value);
            setScore(score + value * 2);
        }

        try {
            // For posts: use API so server can update post.score (persists after refresh)
            if (collection === 'post_votes') {
                const token = pb.authStore.token;
                const res = await fetch(`/api/posts/${targetId}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ value }),
                });
                if (!res.ok) throw new Error('Vote failed');
            } else {
                // Comments: direct PocketBase (comment.score can be synced later if needed)
                const existing = await pb.collection(collection).getList(1, 1, {
                    filter: `${targetField} = "${targetId}" && user = "${user.id}"`,
                });
                if (existing.items.length > 0) {
                    const existingVote = existing.items[0];
                    if (existingVote.value === value) {
                        await pb.collection(collection).delete(existingVote.id);
                    } else {
                        await pb.collection(collection).update(existingVote.id, { value });
                    }
                } else {
                    await pb.collection(collection).create({
                        [targetField]: targetId,
                        user: user.id,
                        value,
                    });
                }
            }
        } catch {
            // Revert on error
            setScore(prevScore);
            setCurrentVote(prevVote);
        } finally {
            setIsLoading(false);
        }
    }, [pb, user, collection, targetField, targetId, score, currentVote, isLoading]);

    return { score, currentVote, vote, isLoading };
}
