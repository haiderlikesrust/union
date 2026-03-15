'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Post, Comment as CommentType, CommentSortType } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PostCard } from '@/components/posts/PostCard';
import { CommentThread } from '@/components/comments/CommentThread';
import { CommentForm } from '@/components/comments/CommentForm';
import { KnowledgeTab, type KnowledgeInitialAdd } from '@/components/knowledge/KnowledgeTab';
import { PostCardSkeleton, CommentSkeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';
import { getPostLockState, setPostLockState } from '@/lib/postLockState';
import { useBlockList } from '@/hooks/useBlockList';

type PostTab = 'discussion' | 'top' | 'knowledge';

export default function PostPage() {
    const { id } = useParams<{ id: string }>();
    const { pb, user } = useAuth();
    const [post, setPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<CommentType[]>([]);
    const [commentSort, setCommentSort] = useState<CommentSortType>('best');
    const [activeTab, setActiveTab] = useState<PostTab>('discussion');
    const [knowledgeInitialAdd, setKnowledgeInitialAdd] = useState<KnowledgeInitialAdd | null>(null);
    const [collapseAll, setCollapseAll] = useState(false);
    const [expandAllSignal, setExpandAllSignal] = useState(0);
    const [collapseAllSignal, setCollapseAllSignal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [userVote, setUserVote] = useState<any>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
    const { blockedIds } = useBlockList();
    const canModeratePost = !!(user && post && (user.id === post.author || user.role === 'admin' || user.role === 'moderator'));
    /** When thread is locked, only bot and admins/mods can comment (not post author) */
    const canCommentWhenLocked = !!(user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'bot'));
    const visibleComments = comments.filter(c => !blockedIds.has(c.author));

    const fetchPost = useCallback(async () => {
        try {
            const record = await pb.collection('posts').getOne(id, { expand: 'author,author.badges,badges' });
            const postData = record as unknown as Post;
            const effectiveLocked = getPostLockState(id, postData.isLocked);
            setPost({ ...postData, isLocked: effectiveLocked });

            // Fetch user vote
            const userId = user?.id;
            if (userId) {
                try {
                    const votes = await pb.collection('post_votes').getList(1, 1, {
                        filter: `post = "${id}" && user = "${userId}"`,
                    });
                    if (votes.items.length > 0) setUserVote(votes.items[0]);
                } catch { }

                // Check if saved
                try {
                    const saves = await pb.collection('saved_posts').getList(1, 1, {
                        filter: `post = "${id}" && user = "${userId}"`,
                    });
                    setIsSaved(saves.items.length > 0);
                } catch { }
            }
            return { ...postData, isLocked: effectiveLocked } as Post;
        } catch (err) {
            console.error('Failed to fetch post:', err);
            return null;
        }
    }, [pb, id, user?.id]);

    const fetchComments = useCallback(async () => {
        try {
            const result = await pb.collection('comments').getFullList({
                filter: `post = "${id}"`,
                sort: '-created',
                expand: 'author,author.badges',
            });
            setComments(result as unknown as CommentType[]);
        } catch (err) {
            console.error('Failed to fetch comments:', err);
        }
    }, [pb, id]);

    const fetchRelatedPosts = useCallback(async (postRecord: Post | null) => {
        if (!postRecord?.flair) {
            setRelatedPosts([]);
            return;
        }
        try {
            const res = await pb.collection('posts').getList(1, 4, {
                filter: `flair = "${postRecord.flair}" && id != "${id}"`,
                sort: '-score,-created',
                expand: 'author',
            });
            setRelatedPosts((res.items as unknown as Post[]) ?? []);
        } catch {
            setRelatedPosts([]);
        }
    }, [pb, id]);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        async function load() {
            setIsLoading(true);
            const [postResult] = await Promise.all([fetchPost(), fetchComments()]);
            if (cancelled) return;
            await fetchRelatedPosts(postResult as unknown as Post | null);
            if (!cancelled) setIsLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, [id, fetchPost, fetchComments, fetchRelatedPosts]);

    // Refetch post when window gains focus (e.g. lock was toggled from feed, then navigated here)
    useEffect(() => {
        if (!id || !user) return;
        const onFocus = () => { fetchPost(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [id, user, fetchPost]);

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    {/* Back link */}
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-4">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to feed
                    </Link>

                    {isLoading ? (
                        <>
                            <PostCardSkeleton />
                            <div className="mt-6 space-y-4">
                                <CommentSkeleton />
                                <CommentSkeleton />
                                <CommentSkeleton />
                            </div>
                        </>
                    ) : post ? (
                        <>
                            {/* Full post */}
                            <PostCard
                                post={post}
                                userVote={userVote}
                                isSaved={isSaved}
                                showFull
                                onPostUpdate={(postId, updates) => {
                                    if (updates.isLocked !== undefined) setPostLockState(postId, updates.isLocked);
                                    setPost(prev => prev ? { ...prev, ...updates } : null);
                                }}
                            />

                            {/* Tabs: Discussion | Top Comments | Knowledge */}
                            <div className="mt-6 flex border-b border-border">
                                {([
                                    { id: 'discussion' as PostTab, label: 'Discussion' },
                                    { id: 'top' as PostTab, label: 'Top Comments' },
                                    { id: 'knowledge' as PostTab, label: 'Knowledge' },
                                ]).map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                            ? 'border-accent text-accent'
                                            : 'border-transparent text-text-muted hover:text-text-primary'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab content */}
                            {activeTab === 'knowledge' && (
                                <div className="mt-4">
                                    <KnowledgeTab
                                        postId={id}
                                        postScore={post.score ?? 0}
                                        commentCount={comments.length}
                                        initialAdd={knowledgeInitialAdd}
                                        onInitialAddConsumed={() => setKnowledgeInitialAdd(null)}
                                    />
                                </div>
                            )}

                            {(activeTab === 'discussion' || activeTab === 'top') && (
                            <>
                            {/* Comment Form - only on Discussion */}
                            {activeTab === 'discussion' && (
                            <div className="mt-6 mb-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <h3 className="text-lg font-semibold">
                                        Comments ({comments.length})
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg border border-border">
                                            <span className="text-xs text-text-muted px-2">Sort by:</span>
                                            {(['best', 'top', 'new', 'controversial', 'old'] as CommentSortType[]).map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => setCommentSort(s)}
                                                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all capitalize ${commentSort === s ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                                                        }`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                        {comments.length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => { setCollapseAll(false); setExpandAllSignal(s => s + 1); }}
                                                    className="px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-all"
                                                >
                                                    Expand all
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCollapseAll(true); setCollapseAllSignal(s => s + 1); }}
                                                    className="px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-all"
                                                >
                                                    Collapse all
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {post.isLocked && !canCommentWhenLocked && (
                                    <div className="p-3 rounded-xl border border-warning/30 bg-warning/5 text-sm text-text-muted mb-3">
                                        This thread is locked. Only the Union bot and moderators can comment.
                                    </div>
                                )}
                                {post.isLocked && canCommentWhenLocked && (
                                    <p className="text-xs text-text-muted mb-2">Thread is locked. You can still comment as {user?.role === 'bot' ? 'the Union bot' : 'a moderator'}.</p>
                                )}
                                <CommentForm postId={id} onSubmit={fetchComments} disabled={post.isLocked && !canCommentWhenLocked} />
                            </div>
                            )}

                            {/* Comments Thread - same for Discussion and Top Comments, sort by top when Top Comments */}
                            <div className="mt-4">
                                {comments.length > 0 ? (
                                    <CommentThread
                                        comments={visibleComments}
                                        postId={id}
                                        postAuthorId={post.author}
                                        canModerate={canModeratePost}
                                        canCommentWhenLocked={canCommentWhenLocked}
                                        isLocked={!!post.isLocked}
                                        onRefresh={fetchComments}
                                        onAddToKnowledge={(content) => {
                                            setKnowledgeInitialAdd({ sectionKey: 'best_answers', content });
                                            setActiveTab('knowledge');
                                        }}
                                        sort={activeTab === 'top' ? 'top' : commentSort}
                                        collapseAll={collapseAll}
                                        expandAllSignal={expandAllSignal}
                                        collapseAllSignal={collapseAllSignal}
                                    />
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-text-muted text-sm">No comments yet. Start the conversation.</p>
                                    </div>
                                )}
                            </div>
                            </>
                            )}
                            {relatedPosts.length > 0 && (
                                <div className="mt-8">
                                    <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Related posts</h4>
                                    <div className="space-y-3">
                                        {relatedPosts.map((rp) => (
                                            <PostCard key={rp.id} post={rp} showCommunity />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20">
                            <h2 className="text-xl font-bold text-text-primary mb-2">Post not found</h2>
                            <p className="text-text-muted">This post may have been deleted.</p>
                            <Link href="/" className="inline-block mt-4 text-accent hover:text-accent-hover">
                                Back to The Union
                            </Link>
                        </div>
                    )}
                </div>
            </main>
            <MobileNav />
        </>
    );
}
