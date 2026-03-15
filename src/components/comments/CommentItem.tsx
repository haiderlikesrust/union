'use client';

import { Comment } from '@/lib/types';
import { MarkdownWithMentions } from '@/components/ui/MarkdownWithMentions';
import { Avatar } from '@/components/ui/Avatar';
import { VoteButtons } from '@/components/posts/VoteButtons';
import { CommentForm } from '@/components/comments/CommentForm';
import { ReportModal } from '@/components/ui/ReportModal';
import { useVote } from '@/hooks/useVote';
import { useAuth } from '@/lib/auth';
import { getRecordFileUrl } from '@/lib/pocketbase';
import { timeAgo } from '@/lib/utils';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface CommentItemProps {
    comment: Comment;
    postId: string;
    postAuthorId?: string;
    canModerate?: boolean;
    /** When locked, only users with this true can reply (bot + admins/mods) */
    canCommentWhenLocked?: boolean;
    isLocked?: boolean;
    depth: number;
    onRefresh: () => void;
    /** When provided, show "Add to Knowledge" and call with comment content when clicked */
    onAddToKnowledge?: (content: string) => void;
    /** When true, force this comment to render collapsed (e.g. "Collapse all") */
    forceCollapsed?: boolean;
    /** When this number changes, expand this comment (e.g. "Expand all") */
    expandAllSignal?: number;
    /** When this number changes, collapse this comment (e.g. "Collapse all") */
    collapseAllSignal?: number;
}

export function CommentItem({ comment, postId, postAuthorId, canModerate = false, canCommentWhenLocked = false, isLocked = false, depth, onRefresh, onAddToKnowledge, forceCollapsed = false, expandAllSignal, collapseAllSignal }: CommentItemProps) {
    const { pb, user, isAdmin } = useAuth();
    const [showReply, setShowReply] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [manuallyExpanded, setManuallyExpanded] = useState(false);

    useEffect(() => {
        if (expandAllSignal != null && expandAllSignal > 0) {
            setIsCollapsed(false);
            setManuallyExpanded(false);
        }
    }, [expandAllSignal]);
    useEffect(() => {
        if (collapseAllSignal != null && collapseAllSignal > 0) {
            setIsCollapsed(true);
            setManuallyExpanded(false);
        }
    }, [collapseAllSignal]);

    const { score, currentVote, vote } = useVote({
        collection: 'comment_votes',
        targetField: 'comment',
        targetId: comment.id,
        initialScore: comment.score || 0,
        initialVote: 0,
    });

    const author = comment.expand?.author;
    const isOwner = user?.id === comment.author;
    const canReply = !!user && (!isLocked || canCommentWhenLocked);
    const canPin = !!user && (canModerate || user.id === postAuthorId);

    // Get highest tier user badge
    const authorBadges = author?.expand?.badges || [];
    const topUserBadge = authorBadges.filter(b => b.type === 'user').sort((a, b) => b.tier - a.tier)[0];

    const handleEdit = async () => {
        if (!editContent.trim()) return;
        try {
            await pb.collection('comments').update(comment.id, { content: editContent });
            setIsEditing(false);
            toast.success('Comment updated');
            onRefresh();
        } catch {
            toast.error('Failed to update comment');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this comment?')) return;
        try {
            await pb.collection('comments').delete(comment.id);
            setIsDeleted(true);
            toast.success('Comment deleted');
            onRefresh();
        } catch {
            toast.error('Failed to delete comment');
        }
    };

    const handleTogglePin = async () => {
        if (!canPin) return;
        try {
            await pb.collection('comments').update(comment.id, { isPinned: !comment.isPinned });
            toast.success(comment.isPinned ? 'Comment unpinned' : 'Comment pinned');
            onRefresh();
        } catch {
            toast.error('Failed to update pin');
        }
    };

    if (isDeleted) return null;

    const displayCollapsed = (forceCollapsed && !manuallyExpanded) || isCollapsed;
    if (displayCollapsed) {
        return (
            <div className="p-2 pl-3">
                <button
                    onClick={() => { if (forceCollapsed) setManuallyExpanded(true); else setIsCollapsed(false); }}
                    className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">{author?.username || 'user'}</span>
                    <span>•</span>
                    <span>{score} points</span>
                </button>
            </div>
        );
    }

    return (
        <div className="group/comment">
            <div className="p-3 hover:bg-bg-hover/30 transition-colors rounded-r-lg">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="text-text-muted hover:text-text-primary transition-colors"
                        title="Collapse"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>
                    {author && (
                        <Link href={`/user/${author.username}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                            <Avatar user={author} size="xs" />
                            <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
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
                    <span className="text-[11px] text-text-muted">{timeAgo(comment.created)}</span>
                    {comment.updated !== comment.created && (
                        <span className="text-[10px] text-text-muted italic">(edited)</span>
                    )}
                    {comment.isPinned && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success uppercase tracking-wide font-semibold">
                            Pinned
                        </span>
                    )}
                </div>

                {/* Content */}
                {isEditing ? (
                    <div className="ml-5 mb-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary resize-none focus:border-accent focus:outline-none"
                            rows={3}
                        />
                        <div className="flex gap-2 mt-2">
                            <button onClick={handleEdit} className="px-3 py-1 bg-accent text-white text-xs rounded-lg hover:bg-accent-hover">
                                Save
                            </button>
                            <button onClick={() => { setIsEditing(false); setEditContent(comment.content); }} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-text-secondary leading-relaxed ml-5 markdown-content">
                        <MarkdownWithMentions content={comment.content} />
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 ml-4 mt-1.5">
                    <VoteButtons
                        score={score}
                        currentVote={currentVote}
                        onUpvote={() => vote(1)}
                        onDownvote={() => vote(-1)}
                        horizontal
                        size="sm"
                    />

                    {canReply && (
                        <button
                            onClick={() => setShowReply(!showReply)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors ml-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Reply
                        </button>
                    )}

                    {user && onAddToKnowledge && (
                        <button
                            onClick={() => onAddToKnowledge(comment.content)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                            title="Add to Knowledge"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Add to Knowledge
                        </button>
                    )}

                    {user && !isOwner && (
                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="px-2 py-1 rounded text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                        >
                            Report
                        </button>
                    )}
                    {(isOwner || isAdmin) && (
                        <>
                            {isOwner && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-2 py-1 rounded text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                            <button
                                onClick={handleDelete}
                                className="px-2 py-1 rounded text-[11px] text-danger/60 hover:bg-danger/10 hover:text-danger transition-colors"
                            >
                                Delete
                            </button>
                        </>
                    )}
                    {canPin && (
                        <button
                            onClick={handleTogglePin}
                            className="px-2 py-1 rounded text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
                        >
                            {comment.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                    )}
                </div>

                {/* Reply form */}
                {showReply && canReply && (
                    <div className="ml-5 mt-2">
                        <CommentForm
                            postId={postId}
                            parentId={comment.id}
                            onSubmit={() => { setShowReply(false); onRefresh(); }}
                            onCancel={() => setShowReply(false)}
                            autoFocus
                        />
                    </div>
                )}
            </div>
            <ReportModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                targetType="comment"
                targetId={comment.id}
                onSuccess={onRefresh}
            />
        </div>
    );
}
