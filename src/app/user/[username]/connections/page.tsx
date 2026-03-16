'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFollowList } from '@/hooks/useFollowList';
import { useBlockList } from '@/hooks/useBlockList';
import type { User } from '@/lib/types';
import toast from 'react-hot-toast';

type Tab = 'followers' | 'following';

interface FollowRecord {
    id: string;
    follower: string;
    following: string;
    expand?: {
        follower?: User;
        following?: User;
    };
}

export default function UserConnectionsPage() {
    const { username } = useParams<{ username: string }>();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'followers';

    const { pb, user: currentUser } = useAuth();
    const { isFollowing, followUser, unfollowUser } = useFollowList();
    const { isBlocked, blockUser, unblockUser } = useBlockList();

    const [tab, setTab] = useState<Tab>(initialTab);
    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [followers, setFollowers] = useState<User[]>([]);
    const [following, setFollowing] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            try {
                const users = await pb.collection('users').getList(1, 1, {
                    filter: `username = "${username}"`,
                });

                if (users.items.length === 0) {
                    if (!cancelled) {
                        setProfileUser(null);
                        setFollowers([]);
                        setFollowing([]);
                    }
                    return;
                }

                const foundUser = users.items[0] as unknown as User;

                const [followersResult, followingResult] = await Promise.all([
                    pb.collection('user_follows').getFullList({
                        filter: `following = "${foundUser.id}"`,
                        expand: 'follower',
                        sort: '-created',
                    }),
                    pb.collection('user_follows').getFullList({
                        filter: `follower = "${foundUser.id}"`,
                        expand: 'following',
                        sort: '-created',
                    }),
                ]);

                if (cancelled) return;

                setProfileUser(foundUser);
                setFollowers(
                    (followersResult as unknown as FollowRecord[])
                        .map((record) => record.expand?.follower)
                        .filter((user): user is User => !!user)
                );
                setFollowing(
                    (followingResult as unknown as FollowRecord[])
                        .map((record) => record.expand?.following)
                        .filter((user): user is User => !!user)
                );
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setProfileUser(null);
                    setFollowers([]);
                    setFollowing([]);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [pb, username]);

    const visibleUsers = useMemo(() => (tab === 'followers' ? followers : following), [tab, followers, following]);

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4 min-h-screen">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="mb-6">
                        <Link href={profileUser ? `/user/${profileUser.username}` : '/'} className="text-sm text-accent hover:text-accent-hover">
                            ← Back to profile
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-48 rounded-xl" />
                            <Skeleton className="h-24 w-full rounded-2xl" />
                            <Skeleton className="h-24 w-full rounded-2xl" />
                            <Skeleton className="h-24 w-full rounded-2xl" />
                        </div>
                    ) : !profileUser ? (
                        <EmptyState title="User not found" description="This user doesn't exist or has been removed." />
                    ) : (
                        <>
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-text-primary">{profileUser.username}</h1>
                                <p className="text-sm text-text-muted mt-1">See who follows them and who they follow.</p>
                            </div>

                            <div className="flex border-b border-border mb-6 overflow-x-auto">
                                <button
                                    onClick={() => setTab('followers')}
                                    className={`px-5 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === 'followers' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'}`}
                                >
                                    Followers ({followers.length})
                                </button>
                                <button
                                    onClick={() => setTab('following')}
                                    className={`px-5 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === 'following' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'}`}
                                >
                                    Following ({following.length})
                                </button>
                            </div>

                            {visibleUsers.length === 0 ? (
                                <EmptyState
                                    title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                                    description={tab === 'followers' ? `${profileUser.username} doesn’t have followers yet.` : `${profileUser.username} isn’t following anyone yet.`}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {visibleUsers.map((listedUser) => {
                                        const isOwnProfile = currentUser?.id === listedUser.id;
                                        const blocked = isBlocked(listedUser.id);
                                        const followingUser = isFollowing(listedUser.id);

                                        return (
                                            <div key={listedUser.id} className="flex items-center justify-between gap-4 p-4 bg-bg-secondary border border-border rounded-2xl">
                                                <Link href={`/user/${listedUser.username}`} className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity">
                                                    <Avatar user={listedUser} size="md" />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-text-primary truncate">{listedUser.username}</div>
                                                        {listedUser.bio && (
                                                            <p className="text-sm text-text-muted truncate max-w-[32rem]">{listedUser.bio}</p>
                                                        )}
                                                    </div>
                                                </Link>

                                                {!isOwnProfile && currentUser && (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {blocked ? (
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await unblockUser(listedUser.id);
                                                                        toast.success('User unblocked');
                                                                    } catch {
                                                                        toast.error('Failed to unblock');
                                                                    }
                                                                }}
                                                                className="px-3 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-primary text-sm font-medium rounded-lg border border-border transition-colors"
                                                            >
                                                                Unblock
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            if (followingUser) {
                                                                                await unfollowUser(listedUser.id);
                                                                                toast.success('Unfollowed');
                                                                            } else {
                                                                                await followUser(listedUser.id);
                                                                                toast.success('Following');
                                                                            }
                                                                        } catch {
                                                                            toast.error('Something went wrong');
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${followingUser ? 'bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border' : 'bg-accent hover:bg-accent-hover text-white'}`}
                                                                >
                                                                    {followingUser ? 'Unfollow' : 'Follow'}
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!confirm('Block this user? You won’t see their posts or comments.')) return;
                                                                        try {
                                                                            await blockUser(listedUser.id);
                                                                            toast.success('User blocked');
                                                                        } catch {
                                                                            toast.error('Failed to block');
                                                                        }
                                                                    }}
                                                                    className="px-3 py-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium rounded-lg transition-colors"
                                                                >
                                                                    Block
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            <MobileNav />
        </>
    );
}
