'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { User } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function NewMessagePage() {
    const { pb, user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const withUsername = searchParams.get('with') ?? '';
    const [targetUser, setTargetUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState(withUsername);
    const [isLoadingTarget, setIsLoadingTarget] = useState(!!withUsername);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
    }, [user, router]);

    useEffect(() => {
        if (!withUsername || !pb) return;
        let cancelled = false;
        setIsLoadingTarget(true);
        pb.collection('users').getList(1, 1, {
            filter: `username = "${withUsername}"`,
            expand: 'badges',
        }).then((res) => {
            if (cancelled) return;
            const u = res.items[0] as unknown as User;
            setTargetUser(u || null);
            if (u && !search) setSearch(u.username);
        }).catch(() => {
            if (!cancelled) setTargetUser(null);
        }).finally(() => {
            if (!cancelled) setIsLoadingTarget(false);
        });
        return () => { cancelled = true; };
    }, [pb, withUsername]);

    const searchUsers = useCallback(async () => {
        const q = search.trim();
        if (q.length < 2) {
            setUsers([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await pb.collection('users').getList(1, 10, {
                filter: `username ~ "${q}"`,
                expand: 'badges',
            });
            const list = (res.items as unknown as User[]).filter((u) => u.id !== user?.id);
            setUsers(list);
        } catch {
            setUsers([]);
        } finally {
            setIsSearching(false);
        }
    }, [pb, search, user?.id]);

    const startConversation = async (other: User) => {
        if (!user || !pb) return;
        if (other.id === user.id) {
            toast.error("You can't message yourself");
            return;
        }
        try {
            const existing = await pb.collection('conversations').getList(1, 1, {
                filter: `(user1 = "${user.id}" && user2 = "${other.id}") || (user1 = "${other.id}" && user2 = "${user.id}")`,
            });
            if (existing.items.length > 0) {
                router.push(`/messages/${existing.items[0].id}`);
                return;
            }
            const conv = await pb.collection('conversations').create({
                user1: user.id,
                user2: other.id,
            });
            router.push(`/messages/${conv.id}`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to start conversation');
        }
    };

    if (!user) return null;

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Link
                            href="/messages"
                            className="p-2 rounded-full hover:bg-bg-hover transition-colors"
                        >
                            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h1 className="text-xl font-bold text-text-primary">New message</h1>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-text-muted">Find user by username</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchUsers())}
                                placeholder="Username"
                                className="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={searchUsers}
                                disabled={isSearching || search.trim().length < 2}
                                className="px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl font-medium text-sm"
                            >
                                Search
                            </button>
                        </div>

                        {withUsername && isLoadingTarget && (
                            <div className="flex items-center gap-3 p-4 bg-bg-secondary rounded-xl border border-border">
                                <Skeleton className="w-12 h-12 rounded-full" />
                                <Skeleton className="w-32 h-5" />
                            </div>
                        )}

                        {targetUser && withUsername && !isLoadingTarget && (
                            <div className="border border-border rounded-xl overflow-hidden">
                                <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-4 pt-3 pb-1">Start conversation with</p>
                                <button
                                    type="button"
                                    onClick={() => startConversation(targetUser)}
                                    className="w-full flex items-center gap-3 p-4 hover:bg-bg-hover transition-colors text-left"
                                >
                                    <Avatar user={targetUser} size="md" />
                                    <span className="font-semibold text-text-primary">{targetUser.username}</span>
                                </button>
                            </div>
                        )}

                        {users.length > 0 && (
                            <div className="border border-border rounded-xl overflow-hidden">
                                <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-4 pt-3 pb-1">Search results</p>
                                {users.map((u) => (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => startConversation(u)}
                                        className="w-full flex items-center gap-3 p-4 hover:bg-bg-hover transition-colors text-left border-t border-border first:border-t-0"
                                    >
                                        <Avatar user={u} size="md" />
                                        <span className="font-semibold text-text-primary">{u.username}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {search.trim().length >= 2 && !isSearching && users.length === 0 && !targetUser && (
                            <p className="text-sm text-text-muted">No users found. Try a different username.</p>
                        )}
                    </div>
                </div>
            </main>
            <MobileNav />
        </>
    );
}
