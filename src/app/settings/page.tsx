'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useBlockList } from '@/hooks/useBlockList';
import { useFollowList } from '@/hooks/useFollowList';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { User } from '@/lib/types';

export default function SettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { theme, changeThemeWithAnimation, themes } = useTheme();
    const { blockedIds, unblockUser, refresh } = useBlockList();
    const { followingIds } = useFollowList();
    const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
    const [loadingBlocked, setLoadingBlocked] = useState(true);

    useEffect(() => {
        if (!user) {
            router.replace('/login');
            return;
        }
    }, [user, router]);

    const { pb } = useAuth();
    useEffect(() => {
        if (!user || blockedIds.size === 0) {
            setBlockedUsers([]);
            setLoadingBlocked(false);
            return;
        }
        let cancelled = false;
        setLoadingBlocked(true);
        const ids = [...blockedIds];
        const filter = ids.map(id => `id = "${id}"`).join(' || ');
        pb.collection('users').getFullList({ filter })
            .then(res => {
                if (!cancelled) setBlockedUsers(res as unknown as User[]);
            })
            .catch(() => { if (!cancelled) setBlockedUsers([]); })
            .finally(() => { if (!cancelled) setLoadingBlocked(false); });
        return () => { cancelled = true; };
    }, [pb, user, blockedIds]);

    if (!user) return null;

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4 min-h-screen">
                <div className="max-w-2xl mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold text-text-primary mb-2">Settings</h1>
                    <p className="text-sm text-text-muted mb-8">Manage your account and preferences.</p>

                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-text-primary mb-3">App theme</h2>
                        <p className="text-sm text-text-muted mb-3">Change how the app looks. A short animation plays when you switch.</p>
                        <div className="flex flex-wrap gap-3">
                            {themes.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                        changeThemeWithAnimation(t.id);
                                        toast.success(`Theme: ${t.name}`);
                                    }}
                                    className={`px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                        theme === t.id
                                            ? 'bg-accent border-accent text-white'
                                            : 'bg-bg-secondary border-border text-text-primary hover:bg-bg-hover hover:border-border-light'
                                    }`}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-text-primary mb-3">Profile</h2>
                        <Link
                            href={`/user/${user.username}`}
                            className="block p-4 bg-bg-secondary border border-border rounded-xl hover:bg-bg-hover transition-colors"
                        >
                            <span className="text-text-primary font-medium">Edit profile</span>
                            <p className="text-sm text-text-muted mt-1">Update your avatar, banner, and bio.</p>
                        </Link>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-text-primary mb-3">Cloud storage</h2>
                        <Link
                            href="/storage"
                            className="block p-4 bg-bg-secondary border border-border rounded-xl hover:bg-bg-hover transition-colors"
                        >
                            <span className="text-text-primary font-medium">My storage (5GB)</span>
                            <p className="text-sm text-text-muted mt-1">Encrypted storage for your images, documents, and files. Delete anytime.</p>
                        </Link>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-text-primary mb-3">Blocked users</h2>
                        <p className="text-sm text-text-muted mb-3">Users you've blocked won't appear in your feed or comments. You can unblock them here.</p>
                        {loadingBlocked ? (
                            <Skeleton className="h-24 w-full rounded-xl mb-2" />
                        ) : blockedUsers.length === 0 ? (
                            <div className="p-6 bg-bg-secondary border border-border rounded-xl text-center">
                                <p className="text-sm text-text-muted">You haven't blocked anyone.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {blockedUsers.map(u => (
                                    <li key={u.id} className="flex items-center justify-between p-4 bg-bg-secondary border border-border rounded-xl">
                                        <Link href={`/user/${u.username}`} className="font-medium text-text-primary hover:text-accent">
                                            {u.username}
                                        </Link>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await unblockUser(u.id);
                                                    toast.success(`Unblocked ${u.username}`);
                                                    refresh();
                                                } catch { toast.error('Failed to unblock'); }
                                            }}
                                            className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-bg-hover text-text-primary rounded-lg border border-border"
                                        >
                                            Unblock
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="mb-10">
                        <h2 className="text-lg font-semibold text-text-primary mb-3">Following</h2>
                        <p className="text-sm text-text-muted mb-3">You follow {followingIds.size} {followingIds.size === 1 ? 'person' : 'people'}. Their posts appear in your Following feed.</p>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href={`/user/${user.username}/connections?tab=following`}
                                className="inline-block px-4 py-2 bg-bg-secondary hover:bg-bg-hover border border-border rounded-xl text-sm font-medium text-text-primary transition-colors"
                            >
                                View followers & following
                            </Link>
                            <Link
                                href="/search"
                                className="inline-block px-4 py-2 bg-bg-secondary hover:bg-bg-hover border border-border rounded-xl text-sm font-medium text-text-primary transition-colors"
                            >
                                Find users to follow
                            </Link>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-text-primary mb-3">Notifications</h2>
                        <p className="text-sm text-text-muted">You receive in-app notifications for replies, mentions, and when someone comments on your posts. Manage them from the bell icon in the navbar.</p>
                    </section>
                </div>
            </main>
            <MobileNav />
        </>
    );
}
