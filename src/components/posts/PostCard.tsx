'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Post, PostVote } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { VoteButtons } from './VoteButtons';
import { FlairBadge } from '@/components/ui/FlairBadge';
import { useVote } from '@/hooks/useVote';
import { useAuth } from '@/lib/auth';
import { useSiteSettings } from '@/lib/site-settings';
import { getPostLockState, setPostLockState } from '@/lib/postLockState';
import { timeAgo, formatNumber, truncateText, extractDomain } from '@/lib/utils';

function isVideoMedia(filename: string): boolean {
    if (!filename) return false;
    const lower = filename.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.ogg');
}
import { getRecordFileUrl } from '@/lib/pocketbase';
import { ReportModal } from '@/components/ui/ReportModal';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { MarkdownWithMentions } from '@/components/ui/MarkdownWithMentions';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

interface PostCardProps {
    post: Post;
    userVote?: PostVote | null;
    isSaved?: boolean;
    onDelete?: () => void;
    onHide?: () => void;
    showFull?: boolean;
    /** Show "The Union" community label before author (Reddit-style feed) */
    showCommunity?: boolean;
    /** Show "Knowledge" badge (thread has a wiki page) */
    showKnowledgeBadge?: boolean;
    /** Called after lock/unlock so parent can update post in state (keeps lock state in sync when navigating) */
    onPostUpdate?: (postId: string, updates: Partial<Post>) => void;
}

export function PostCard({ post, userVote, isSaved: initialSaved = false, onDelete, onHide, showFull = false, showCommunity = false, showKnowledgeBadge = false, onPostUpdate }: PostCardProps) {
    const router = useRouter();
    const { pb, user, isAdmin } = useAuth();
    const { siteName, logoUrl } = useSiteSettings();
    const [saved, setSaved] = useState(initialSaved);
    const [isDeleting, setIsDeleting] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const [deletedState, setDeletedState] = useState(!!post.isDeleted);
    const isDeleted = post.isDeleted || deletedState;
    const isLocked = getPostLockState(post.id, post.isLocked);

    useEffect(() => {
        if (!moreMenuOpen) return;
        const close = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false);
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [moreMenuOpen]);

    const { score, currentVote, vote } = useVote({
        collection: 'post_votes',
        targetField: 'post',
        targetId: post.id,
        initialScore: post.score || 0,
        initialVote: userVote?.value || 0,
    });

    const author = post.expand?.author;
    const isOwner = user?.id === post.author;

    // Get highest tier user badge
    const authorBadges = author?.expand?.badges || [];
    const topUserBadge = authorBadges.filter(b => b.type === 'user').sort((a, b) => b.tier - a.tier)[0];

    // Get post badges
    const postBadges = post.expand?.badges || [];

    const handleSave = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { toast.error('Log in to save posts'); return; }

        try {
            if (saved) {
                // Find and delete save record
                const saves = await pb.collection('saved_posts').getList(1, 1, {
                    filter: `post = "${post.id}" && user = "${user.id}"`,
                });
                if (saves.items.length > 0) {
                    await pb.collection('saved_posts').delete(saves.items[0].id);
                }
                setSaved(false);
                toast.success('Post unsaved');
            } else {
                await pb.collection('saved_posts').create({ post: post.id, user: user.id });
                setSaved(true);
                toast.success('Post saved');
            }
        } catch {
            toast.error('Failed to save post');
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this post?')) return;
        setIsDeleting(true);
        try {
            await pb.collection('posts').update(post.id, {
                isDeleted: true,
                title: '[deleted]',
                body: '',
                url: '',
            });
            setDeletedState(true);
            toast.success('Post deleted');
        } catch {
            toast.error('Failed to delete post');
            setIsDeleting(false);
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
        toast.success('Link copied!');
    };

    const handleToggleLock = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const canModerate = !!user && (isAdmin || user.role === 'moderator' || isOwner);
        if (!canModerate) return;
        const newLocked = !isLocked;
        try {
            await pb.collection('posts').update(post.id, { isLocked: newLocked });
            setPostLockState(post.id, newLocked);
            onPostUpdate?.(post.id, { isLocked: newLocked });
            toast.success(newLocked ? 'Thread locked' : 'Thread unlocked');
        } catch {
            toast.error('Failed to update thread lock');
        }
    };

    if (isDeleting) return null;

    const cardClassName = `block bg-bg-secondary rounded-xl border border-border hover:border-border-light transition-all group ${showFull ? '' : !isDeleted ? 'cursor-pointer' : ''}`;

    const deletedPlaceholder = (
        <div className="flex gap-3 p-3 sm:p-4">
            <div className="hidden sm:flex shrink-0">
                <VoteButtons score={score} currentVote={currentVote} onUpvote={() => vote(1)} onDownvote={() => vote(-1)} />
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-3 py-2">
                <span className="text-sm text-text-muted italic">[deleted post]</span>
                <span className="text-xs text-text-muted">{timeAgo(post.created)}</span>
                {!showFull && (
                    <Link href={`/post/${post.id}`} className="text-xs text-accent hover:text-accent-hover">
                        View comments
                    </Link>
                )}
            </div>
        </div>
    );

    const cardContent = (
        <div className="flex gap-3 p-3 sm:p-4">
            {/* Vote column */}
            <div className="hidden sm:flex shrink-0">
                <VoteButtons
                    score={score}
                    currentVote={currentVote}
                    onUpvote={() => vote(1)}
                    onDownvote={() => vote(-1)}
                />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Header — Reddit-style: community • author • time */}
                <div className="flex items-center gap-2 text-xs text-text-muted mb-1.5 flex-wrap">
                    {showCommunity && (
                        <>
                            <span className="font-medium text-text-secondary flex items-center gap-1">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="" className="w-5 h-5 rounded-sm object-cover shrink-0" />
                                ) : (
                                    <span className="w-5 h-5 rounded-sm bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">TU</span>
                                )}
                                {siteName}
                            </span>
                            <span>·</span>
                        </>
                    )}
                    {author && (
                        <Link
                            href={`/user/${author.username}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
                        >
                            <Avatar user={author} size="xs" />
                            <span className="font-medium text-text-secondary flex items-center gap-1.5">
                                {author.username}
                                {author.role === 'bot' && (
                                    <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                        Bot
                                    </span>
                                )}
                            </span>
                            {topUserBadge && (
                                <img
                                    src={getRecordFileUrl(topUserBadge, topUserBadge.image)}
                                    alt={topUserBadge.name}
                                    title={topUserBadge.name}
                                    className="w-3.5 h-3.5 object-cover rounded-sm ml-0.5"
                                />
                            )}
                        </Link>
                    )}
                    <span>•</span>
                    <span>{timeAgo(post.created)}</span>
                    {post.flair && (
                        <>
                            <span>•</span>
                            <FlairBadge flair={post.flair} />
                        </>
                    )}
                    {showKnowledgeBadge && (
                        <>
                            <span>•</span>
                            <Link
                                href={`/post/${post.id}#knowledge`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 font-medium text-success hover:text-success/90"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Knowledge
                            </Link>
                        </>
                    )}
                    {post.isPinned && (
                        <span className="flex items-center gap-1 text-success font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                            </svg>
                            Pinned
                        </span>
                    )}
                    {postBadges.map(badge => (
                        <span key={badge.id} className="flex items-center">
                            <img
                                src={getRecordFileUrl(badge, badge.image)}
                                alt={badge.name}
                                title={badge.name}
                                className="w-4 h-4 object-cover rounded-sm ml-1"
                            />
                        </span>
                    ))}
                    {isLocked && (
                        <span className="flex items-center gap-1 text-warning font-medium">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm0 0v7m-7 0h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
                            </svg>
                            Locked
                        </span>
                    )}
                </div>

                {/* Title */}
                <h2 className={`font-semibold text-text-primary group-hover:text-accent transition-colors ${showFull ? 'text-xl' : 'text-base'}`}>
                    {post.title}
                </h2>

                {/* Body / Image / Link preview */}
                {post.type === 'text' && post.body && (
                    <div className={`mt-2 text-sm text-text-secondary leading-relaxed markdown-content ${showFull ? '' : 'line-clamp-3'}`}>
                        <MarkdownWithMentions content={showFull ? post.body : truncateText(post.body, 300)} />
                    </div>
                )}

                {post.type === 'image' && post.image && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-border">
                        {isVideoMedia(post.image) ? (
                            <video
                                src={getRecordFileUrl(
                                    { id: post.id, collectionId: post.collectionId, collectionName: post.collectionName },
                                    post.image
                                )}
                                controls
                                className={`w-full ${showFull ? 'max-h-[600px]' : 'max-h-[400px]'}`}
                                preload="metadata"
                                playsInline
                            />
                        ) : (
                            <ImageLightbox
                                src={getRecordFileUrl(
                                    { id: post.id, collectionId: post.collectionId, collectionName: post.collectionName },
                                    post.image
                                )}
                                alt={post.title}
                            >
                                <img
                                    src={getRecordFileUrl(
                                        { id: post.id, collectionId: post.collectionId, collectionName: post.collectionName },
                                        post.image
                                    )}
                                    alt={post.title}
                                    className={`w-full object-cover ${showFull ? 'max-h-[600px]' : 'max-h-[400px]'}`}
                                    loading="lazy"
                                />
                            </ImageLightbox>
                        )}
                    </div>
                )}
                {post.type === 'image' && post.body && (
                    <div className={`mt-2 text-sm text-text-secondary leading-relaxed markdown-content ${showFull ? '' : 'line-clamp-3'}`}>
                        <MarkdownWithMentions content={showFull ? post.body : truncateText(post.body, 300)} />
                    </div>
                )}

                {post.type === 'link' && post.url && (
                    <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg border border-border hover:border-accent/30 transition-colors group/link"
                    >
                        <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span className="text-sm text-accent group-hover/link:text-accent-hover truncate">{extractDomain(post.url)}</span>
                    </a>
                )}

                {/* Footer */}
                <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {/* Mobile vote buttons */}
                    <div className="sm:hidden mr-2">
                        <VoteButtons
                            score={score}
                            currentVote={currentVote}
                            onUpvote={() => vote(1)}
                            onDownvote={() => vote(-1)}
                            horizontal
                            size="sm"
                        />
                    </div>

                    {/* Comments */}
                    {!showFull && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-text-muted hover:bg-bg-hover transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {formatNumber(post.commentCount || 0)} comments
                        </span>
                    )}

                    {/* Share */}
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share
                    </button>

                    {/* Save */}
                    <button
                        onClick={handleSave}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-colors ${saved ? 'text-warning bg-warning/10' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
                            }`}
                    >
                        <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        {saved ? 'Saved' : 'Save'}
                    </button>

                    {/* Report */}
                    {user && !isOwner && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setReportModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                            title="Report"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                            Report
                        </button>
                    )}

                    {/* Hide (feed only) */}
                    {!showFull && onHide && user && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onHide();
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                            title="Hide post"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.066 5.72m0 0L21 21" />
                            </svg>
                            Hide
                        </button>
                    )}

                    {/* Edit/Delete/Lock — mobile: overflow menu; desktop: inline */}
                    {(isOwner || isAdmin || user?.role === 'moderator') && (
                        <div ref={moreMenuRef} className="flex items-center gap-1 ml-auto relative">
                            {/* Mobile: single "More" button with dropdown */}
                            <div className="sm:hidden">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMoreMenuOpen((v) => !v);
                                    }}
                                    className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-1.5 rounded-full text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                                    aria-label="More actions"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="6" r="1.5" />
                                        <circle cx="12" cy="12" r="1.5" />
                                        <circle cx="12" cy="18" r="1.5" />
                                    </svg>
                                </button>
                                {moreMenuOpen && (
                                    <div
                                        className="absolute right-0 bottom-full mb-1 py-1.5 bg-bg-secondary border border-border rounded-xl shadow-lg min-w-[140px] z-10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {isOwner && (
                                            <Link
                                                href={`/post/${post.id}/edit`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMoreMenuOpen(false);
                                                }}
                                                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover rounded-lg"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </Link>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMoreMenuOpen(false);
                                                handleDelete(e);
                                            }}
                                            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-danger/10 rounded-lg"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMoreMenuOpen(false);
                                                handleToggleLock(e);
                                            }}
                                            className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-warning hover:bg-warning/10 rounded-lg"
                                        >
                                            {isLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Desktop: inline buttons */}
                            <div className="hidden sm:flex items-center gap-1">
                                {isOwner && (
                                    <Link
                                        href={`/post/${post.id}/edit`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                    </Link>
                                )}
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-danger/70 hover:bg-danger/10 hover:text-danger transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                </button>
                                <button
                                    onClick={handleToggleLock}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-warning hover:bg-warning/10 transition-colors"
                                >
                                    {isLocked ? 'Unlock' : 'Lock'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Media thumbnail on the right (compact mode) */}
            {!showFull && post.type === 'image' && post.image && (
                <div className="hidden md:block shrink-0 w-32 h-24 rounded-lg overflow-hidden border border-border bg-bg-tertiary">
                    {isVideoMedia(post.image) ? (
                        <video
                            src={getRecordFileUrl(
                                { id: post.id, collectionId: post.collectionId, collectionName: post.collectionName },
                                post.image
                            )}
                            className="w-full h-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                        />
                    ) : (
                        <ImageLightbox
                            src={getRecordFileUrl(
                                { id: post.id, collectionId: post.collectionId, collectionName: post.collectionName },
                                post.image
                            )}
                            alt={post.title}
                        >
                            <img
                                src={getRecordFileUrl(
                                    { id: post.id, collectionId: post.collectionId, collectionName: post.collectionName },
                                    post.image
                                )}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </ImageLightbox>
                    )}
                </div>
            )}
        </div>
    );

    const contentToRender = isDeleted ? deletedPlaceholder : cardContent;

    return (
        <>
            <ReportModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                targetType="post"
                targetId={post.id}
            />
            {showFull ? (
                <div className={cardClassName}>{contentToRender}</div>
            ) : isDeleted ? (
                <div className={cardClassName}>{contentToRender}</div>
            ) : (
                <div
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/post/${post.id}`)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/post/${post.id}`);
                        }
                    }}
                    className={cardClassName}
                >
                    {contentToRender}
                </div>
            )}
        </>
    );
}
