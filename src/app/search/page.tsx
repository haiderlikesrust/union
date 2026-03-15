'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Post, User } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PostCard } from '@/components/posts/PostCard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCardSkeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/lib/utils';
import Link from 'next/link';
import { Suspense } from 'react';

function SearchContent() {
    const { pb } = useAuth();
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const flair = searchParams.get('flair') || '';

    const [tab, setTab] = useState<'posts' | 'users'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [knowledgePostIds, setKnowledgePostIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!query && !flair) return;

        async function search() {
            setIsLoading(true);
            try {
                // Search posts
                let postFilter = '';
                if (query) {
                    postFilter = `title ~ "${query}" || body ~ "${query}"`;
                }
                if (flair) {
                    postFilter = postFilter ? `(${postFilter}) && flair = "${flair}"` : `flair = "${flair}"`;
                }

                if (!postFilter) {
                    setPosts([]);
                    setKnowledgePostIds(new Set());
                } else {
                    const postResults = await pb.collection('posts').getList(1, 30, {
                        filter: postFilter,
                        sort: '-score,-created',
                        expand: 'author,author.badges,badges',
                    });
                    const postList = postResults.items as unknown as Post[];
                    const postIds = postList.map(p => p.id);
                    let knowledgePostIds = new Set<string>();
                    if (postIds.length > 0) {
                        try {
                            const filterByPosts = postIds.map(id => `post = "${id}"`).join(' || ');
                            const kpRes = await pb.collection('knowledge_pages').getFullList({
                                filter: filterByPosts,
                                fields: 'post',
                            });
                            (kpRes as unknown as { post: string }[]).forEach((kp) => knowledgePostIds.add(kp.post));
                        } catch {
                            // ignore
                        }
                    }
                    postList.sort((a, b) => {
                        const aHas = knowledgePostIds.has(a.id) ? 1 : 0;
                        const bHas = knowledgePostIds.has(b.id) ? 1 : 0;
                        if (bHas !== aHas) return bHas - aHas;
                        return (b.score ?? 0) - (a.score ?? 0) || new Date(b.created).getTime() - new Date(a.created).getTime();
                    });
                    setPosts(postList);
                    setKnowledgePostIds(knowledgePostIds);
                }

                // Search users
                if (query) {
                    const userResults = await pb.collection('users').getList(1, 20, {
                        filter: `username ~ "${query}"`,
                        sort: '-karma',
                    });
                    setUsers(userResults.items as unknown as User[]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        search();
    }, [pb, query, flair]);

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold mb-2">
                {query ? `Search: "${query}"` : flair ? `Flair: ${flair}` : 'Search'}
            </h1>
            <p className="text-sm text-text-muted mb-6">
                {posts.length} posts {query ? `• ${users.length} users` : ''} found
            </p>

            {/* Tabs */}
            {query && (
                <div className="flex border-b border-border mb-4">
                    {(['posts', 'users'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-all capitalize ${tab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">
                    <PostCardSkeleton />
                    <PostCardSkeleton />
                </div>
            ) : (
                <>
                    {tab === 'posts' && (
                        <div className="space-y-3">
                            {posts.length > 0 ? (
                                posts.map(post => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        showKnowledgeBadge={knowledgePostIds.has(post.id)}
                                    />
                                ))
                            ) : (
                                <EmptyState title="No results" description="Try different search terms or browse the feed." />
                            )}
                        </div>
                    )}

                    {tab === 'users' && (
                        <div className="space-y-2">
                            {users.length > 0 ? (
                                users.map(u => (
                                    <Link
                                        key={u.id}
                                        href={`/user/${u.username}`}
                                        className="flex items-center gap-3 p-4 bg-bg-secondary rounded-xl border border-border hover:border-border-light transition-colors"
                                    >
                                        <Avatar user={u} size="md" />
                                        <div>
                                            <p className="font-semibold text-text-primary">{u.username}</p>
                                            <p className="text-xs text-text-muted">
                                                {formatNumber(u.karma || 0)} karma
                                                {u.bio && <span className="ml-2">• {u.bio.slice(0, 60)}</span>}
                                            </p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <EmptyState title="No users found" description="Try searching with a different username." />
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function SearchPage() {
    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <Suspense fallback={
                    <div className="max-w-3xl mx-auto px-4 py-6">
                        <PostCardSkeleton />
                        <PostCardSkeleton />
                    </div>
                }>
                    <SearchContent />
                </Suspense>
            </main>
            <MobileNav />
        </>
    );
}
