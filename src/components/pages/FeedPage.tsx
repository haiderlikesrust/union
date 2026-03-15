'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Post, PostVote, SortType, TopTimeFilter, CommunityRule, User } from '@/lib/types';
import { PostCard } from '@/components/posts/PostCard';
import { Sidebar } from '@/components/layout/Sidebar';
import { PostCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getSortString, getTopTimeFilterDate } from '@/lib/utils';
import { setPostLockState } from '@/lib/postLockState';
import { useBlockList } from '@/hooks/useBlockList';
import { useFollowList } from '@/hooks/useFollowList';
import Link from 'next/link';
import { POCKETBASE_URL } from '@/lib/pocketbase';

export type FeedMode = 'all' | 'following';

const HIDDEN_POSTS_KEY = 'the-union-hidden-posts';

function getHiddenPostIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = localStorage.getItem(HIDDEN_POSTS_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function addHiddenPostId(id: string) {
    const set = getHiddenPostIds();
    set.add(id);
    if (typeof window !== 'undefined') {
        localStorage.setItem(HIDDEN_POSTS_KEY, JSON.stringify([...set]));
    }
}

export function FeedPage() {
    const { pb, user } = useAuth();
    const { blockedIds, isBlocked } = useBlockList();
    const { followingIds, isFollowing } = useFollowList();
    const [posts, setPosts] = useState<Post[]>([]);
    const [userVotes, setUserVotes] = useState<Map<string, PostVote>>(new Map());
    const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
    const [feedMode, setFeedMode] = useState<FeedMode>('all');
    const [sort, setSort] = useState<SortType>('hot');
    const [topTimeFilter, setTopTimeFilter] = useState<TopTimeFilter>('day');
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [setupRequired, setSetupRequired] = useState(false);
    const [rules, setRules] = useState<CommunityRule[]>([]);
    const [moderators, setModerators] = useState<User[]>([]);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const perPage = 20;

    // Fetch community rules and mod list for sidebar
    useEffect(() => {
        async function loadSidebar() {
            try {
                const [rulesRes, usersRes] = await Promise.all([
                    pb.collection('community_rules').getFullList({ sort: 'order' }).catch(() => ({ items: [] })),
                    pb.collection('users').getFullList({ filter: 'role = "admin" || role = "moderator"', expand: 'badges' }).catch(() => ({ items: [] })),
                ]);
                setRules((rulesRes as { items?: CommunityRule[] }).items ?? []);
                setModerators((usersRes as { items?: User[] }).items ?? []);
            } catch { /* ignore */ }
        }
        loadSidebar();
    }, [pb]);

    // Sync hidden IDs from localStorage on mount and when hiding
    const refreshHiddenIds = useCallback(() => {
        setHiddenIds(getHiddenPostIds());
    }, []);

    const fetchPosts = useCallback(async (pageNum: number, sortType: SortType, reset = false, timeFilter?: TopTimeFilter, mode?: FeedMode, followIds?: Set<string>) => {
        setIsLoading(true);
        try {
            const sortStr = getSortString(sortType);
            const useTimeFilter = (sortType === 'top' || sortType === 'controversial') && timeFilter;
            const since = useTimeFilter ? getTopTimeFilterDate(timeFilter || 'day') : null;
            const parts: string[] = [];
            if (since) parts.push(`created >= "${since}"`);
            if (mode === 'following') {
                if (followIds && followIds.size > 0) {
                    const authorFilter = [...followIds].map(id => `author = "${id}"`).join(' || ');
                    parts.push(`(${authorFilter})`);
                } else {
                    parts.push('id = ""'); // no posts when following list is empty
                }
            }
            const filter = parts.length > 0 ? parts.join(' && ') : undefined;

            const result = await pb.collection('posts').getList(pageNum, perPage, {
                sort: sortStr,
                filter: filter || undefined,
                expand: 'author,author.badges,badges',
            });
            let newPosts = (result.items || []) as unknown as Post[];
            newPosts = newPosts.filter(p => !isBlocked(p.author));

            if (reset) {
                setPosts(newPosts);
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }
            setHasMore((result.page || 1) < (result.totalPages || 1));

            if (user && newPosts.length > 0) {
                const postIds = newPosts.map(p => p.id);
                const voteFilter = postIds.map(id => `post = "${id}"`).join(' || ');
                try {
                    const votes = await pb.collection('post_votes').getFullList({
                        filter: `user = "${user.id}" && (${voteFilter})`,
                    });
                    const voteMap = new Map(userVotes);
                    votes.forEach(v => voteMap.set(v.post, v as unknown as PostVote));
                    setUserVotes(voteMap);
                } catch { /* ignore */ }
                try {
                    const saves = await pb.collection('saved_posts').getFullList({
                        filter: `user = "${user.id}" && (${voteFilter})`,
                    });
                    const saveSet = new Set(savedPosts);
                    saves.forEach(s => saveSet.add(s.post));
                    setSavedPosts(saveSet);
                } catch { /* ignore */ }
            }
        } catch (err: unknown) {
            console.error('Failed to fetch posts:', err);
            const pbErr = err as { status?: number };
            if (pbErr?.status === 404) setSetupRequired(true);
            if (reset) setPosts([]);
            setHasMore(false);
        } finally {
            setIsLoading(false);
        }
    }, [pb, user, userVotes, savedPosts, isBlocked]);

    useEffect(() => {
        setPage(1);
        const followSet = feedMode === 'following' ? followingIds : undefined;
        fetchPosts(1, sort, true, topTimeFilter, feedMode, followSet);
    }, [sort, topTimeFilter, feedMode, followingIds]);

    useEffect(() => {
        refreshHiddenIds();
    }, [refreshHiddenIds]);

    const loadMore = useCallback(() => {
        if (isLoading || !hasMore) return;
        setPage((prev) => {
            const nextPage = prev + 1;
            const followSet = feedMode === 'following' ? followingIds : undefined;
            fetchPosts(nextPage, sort, false, topTimeFilter, feedMode, followSet);
            return nextPage;
        });
    }, [isLoading, hasMore, fetchPosts, sort, topTimeFilter, feedMode, followingIds]);

    useEffect(() => {
        const node = loadMoreRef.current;
        if (!node) return;
        const observer = new IntersectionObserver((entries) => {
            const first = entries[0];
            if (first.isIntersecting) {
                loadMore();
            }
        }, { rootMargin: '200px 0px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, isLoading, loadMore]);

    const handleHidePost = (postId: string) => {
        addHiddenPostId(postId);
        setPosts(prev => prev.filter(p => p.id !== postId));
        refreshHiddenIds();
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex gap-6">
                {/* Main Feed */}
                <div className="flex-1 min-w-0">
                    {/* Setup required message */}
                    {setupRequired && (
                        <div className="bg-warning/5 border border-warning/20 rounded-xl p-6 mb-6 animate-fadeIn">
                            <h3 className="text-lg font-bold text-warning mb-2 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Database Setup Required
                            </h3>
                            <p className="text-sm text-text-secondary mb-3">
                                PocketBase collections haven&apos;t been created yet. Run the setup script to create them:
                            </p>
                            <div className="bg-bg-tertiary rounded-lg p-3 font-mono text-sm text-text-primary mb-3">
                                node setup-pb.js your-admin@email.com your-admin-password
                            </div>
                            <p className="text-xs text-text-muted">
                                Make sure PocketBase is running and you&apos;ve created an admin account.
                                {user?.role === 'admin' && (
                                    <> Admin panel: <a href={`${POCKETBASE_URL}/_/`} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">{POCKETBASE_URL}/_/</a></>
                                )}
                            </p>
                        </div>
                    )}

                    {/* Feed mode: Home | Following (logged in only) */}
                    {user && (
                        <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-xl border border-border w-max mb-4">
                            <button
                                type="button"
                                onClick={() => setFeedMode('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${feedMode === 'all' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'}`}
                            >
                                Home
                            </button>
                            <button
                                type="button"
                                onClick={() => setFeedMode('following')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${feedMode === 'following' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'}`}
                            >
                                Following
                            </button>
                        </div>
                    )}

                    {/* Sort tabs (mobile): scrollable row for better touch targets */}
                    <div className="lg:hidden space-y-2 mb-4">
                        <div className="overflow-x-auto overflow-y-hidden -mx-1 px-1">
                            <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-xl border border-border min-w-0 flex-nowrap w-max max-w-full">
                                {(['hot', 'new', 'top', 'rising', 'controversial'] as SortType[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSort(s)}
                                        className={`flex-shrink-0 min-w-[72px] py-2.5 px-3 text-xs font-medium rounded-lg transition-all snap-start ${sort === s ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'
                                            }`}
                                    >
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {(sort === 'top' || sort === 'controversial') && (
                            <div className="flex flex-wrap gap-1.5">
                                {(['hour', 'day', 'week', 'month', 'year', 'all'] as TopTimeFilter[]).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTopTimeFilter(t)}
                                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all min-h-[36px] ${topTimeFilter === t ? 'bg-accent/20 text-accent' : 'bg-bg-secondary text-text-muted hover:text-text-primary border border-border'
                                            }`}
                                    >
                                        {t === 'all' ? 'All time' : t === 'day' ? 'Past 24h' : t === 'hour' ? 'Past hour' : `Past ${t}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Posts — Reddit-style list with dividers */}
                    <div className="space-y-0 divide-y divide-border">
                        {posts
                            .filter(post => !hiddenIds.has(post.id))
                            .map(post => (
                                <div key={post.id} className="py-3 first:pt-0">
                                    <PostCard
                                        post={post}
                                        userVote={userVotes.get(post.id)}
                                        isSaved={savedPosts.has(post.id)}
                                        onDelete={() => setPosts(prev => prev.filter(p => p.id !== post.id))}
                                        onHide={() => handleHidePost(post.id)}
                                        onPostUpdate={(postId, updates) => {
                                            if (updates.isLocked !== undefined) setPostLockState(postId, updates.isLocked);
                                            setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
                                        }}
                                        showCommunity
                                    />
                                </div>
                            ))
                        }

                        {isLoading && (
                            <>
                                <PostCardSkeleton />
                                <PostCardSkeleton />
                                <PostCardSkeleton />
                            </>
                        )}

                        {!isLoading && !setupRequired && posts.length === 0 && (
                            <EmptyState
                                title={feedMode === 'following' ? (followingIds.size === 0 ? 'No one followed yet' : 'No posts from people you follow') : 'No posts yet'}
                                description={feedMode === 'following'
                                    ? (followingIds.size === 0 ? 'Follow users to see their posts here.' : 'Posts from people you follow will show up here.')
                                    : 'The Union is waiting for its first post. Be the pioneer.'}
                                action={feedMode === 'following' && followingIds.size === 0 ? (
                                    <Link href="/search" className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-full text-sm font-medium transition-all">
                                        Find users to follow
                                    </Link>
                                ) : feedMode === 'all' ? (
                                    <Link href="/create" className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-full text-sm font-medium transition-all">
                                        Create First Post
                                    </Link>
                                ) : undefined}
                            />
                        )}

                        {!isLoading && hasMore && posts.length > 0 && (
                            <>
                                <div ref={loadMoreRef} className="h-1" />
                                <button
                                    onClick={loadMore}
                                    className="w-full py-3 text-sm text-text-muted hover:text-text-primary bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-xl transition-all"
                                >
                                    Load more
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <Sidebar
                    currentSort={sort}
                    onSortChange={setSort}
                    topTimeFilter={topTimeFilter}
                    onTopTimeFilterChange={setTopTimeFilter}
                    rules={rules}
                    moderators={moderators}
                />
            </div>
        </div>
    );
}
