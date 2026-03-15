'use client';

import { Comment, CommentSortType } from '@/lib/types';
import { CommentItem } from './CommentItem';

interface CommentThreadProps {
    comments: Comment[];
    postId: string;
    postAuthorId?: string;
    canModerate?: boolean;
    /** When locked, only users with this true can comment/reply (bot + admins/mods, not post author) */
    canCommentWhenLocked?: boolean;
    isLocked?: boolean;
    onRefresh: () => void;
    /** When provided, comments show "Add to Knowledge" and this is called with comment content */
    onAddToKnowledge?: (content: string) => void;
    sort?: CommentSortType;
    /** When true, all comments render collapsed */
    collapseAll?: boolean;
    /** Increment to expand all comments */
    expandAllSignal?: number;
    /** Increment to collapse all comments */
    collapseAllSignal?: number;
}

function sortByType(list: (Comment & { children: Comment[] })[], sortType: CommentSortType) {
    const copy = [...list];
    const pinAwareSort = (cmp: (a: Comment & { children: Comment[] }, b: Comment & { children: Comment[] }) => number) =>
        copy.sort((a, b) => {
            if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
            return cmp(a, b);
        });
    switch (sortType) {
        case 'new':
            return pinAwareSort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        case 'old':
            return pinAwareSort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
        case 'controversial':
            return pinAwareSort((a, b) => Math.abs(a.score || 0) - Math.abs(b.score || 0) || new Date(b.created).getTime() - new Date(a.created).getTime());
        case 'top':
            return pinAwareSort((a, b) => (b.score || 0) - (a.score || 0) || new Date(a.created).getTime() - new Date(b.created).getTime());
        case 'best':
        default:
            return pinAwareSort((a, b) => (b.score || 0) - (a.score || 0) || new Date(b.created).getTime() - new Date(a.created).getTime());
    }
}

/**
 * Builds a nested tree from flat comments list and renders recursively
 */
export function CommentThread({ comments, postId, postAuthorId, canModerate = false, canCommentWhenLocked = false, isLocked = false, onRefresh, onAddToKnowledge, sort = 'best', collapseAll = false, expandAllSignal, collapseAllSignal }: CommentThreadProps) {
    // Build tree structure
    const commentMap = new Map<string, Comment & { children: Comment[] }>();
    const rootComments: (Comment & { children: Comment[] })[] = [];

    // First pass: create map entries
    comments.forEach(c => {
        commentMap.set(c.id, { ...c, children: [] });
    });

    // Second pass: build tree
    comments.forEach(c => {
        const node = commentMap.get(c.id)!;
        if (c.parent && commentMap.has(c.parent)) {
            commentMap.get(c.parent)!.children.push(node);
        } else {
            rootComments.push(node);
        }
    });

    return (
        <div className="space-y-0">
            {sortByType(rootComments, sort).map(comment => (
                <CommentNode
                    key={comment.id}
                    comment={comment}
                    postId={postId}
                    postAuthorId={postAuthorId}
                    canModerate={canModerate}
                    canCommentWhenLocked={canCommentWhenLocked}
                    isLocked={isLocked}
                    depth={0}
                    onRefresh={onRefresh}
                    onAddToKnowledge={onAddToKnowledge}
                    forceCollapsed={collapseAll}
                    expandAllSignal={expandAllSignal}
                    collapseAllSignal={collapseAllSignal}
                />
            ))}
        </div>
    );
}

function CommentNode({
    comment,
    postId,
    postAuthorId,
    canModerate,
    canCommentWhenLocked,
    isLocked,
    depth,
    onRefresh,
    onAddToKnowledge,
    forceCollapsed,
    expandAllSignal,
    collapseAllSignal,
}: {
    comment: Comment & { children: Comment[] };
    postId: string;
    postAuthorId?: string;
    canModerate?: boolean;
    canCommentWhenLocked?: boolean;
    isLocked?: boolean;
    depth: number;
    onRefresh: () => void;
    onAddToKnowledge?: (content: string) => void;
    forceCollapsed?: boolean;
    expandAllSignal?: number;
    collapseAllSignal?: number;
}) {
    const maxDepth = 6;
    const isDeep = depth >= maxDepth;

    return (
        <div className={depth > 0 ? 'ml-3 sm:ml-6 border-l-2 border-border/40' : ''}>
            <CommentItem
                comment={comment}
                postId={postId}
                postAuthorId={postAuthorId}
                canModerate={canModerate}
                canCommentWhenLocked={canCommentWhenLocked}
                isLocked={isLocked}
                depth={depth}
                onRefresh={onRefresh}
                onAddToKnowledge={onAddToKnowledge}
                forceCollapsed={forceCollapsed}
                expandAllSignal={expandAllSignal}
                collapseAllSignal={collapseAllSignal}
            />
            {!isDeep && comment.children.length > 0 && (
                <div>
                    {sortByType(comment.children as (Comment & { children: Comment[] })[], 'best').map(child => (
                            <CommentNode
                                key={child.id}
                                comment={child as Comment & { children: Comment[] }}
                                postId={postId}
                                postAuthorId={postAuthorId}
                                canModerate={canModerate}
                                canCommentWhenLocked={canCommentWhenLocked}
                                isLocked={isLocked}
                                depth={depth + 1}
                                onRefresh={onRefresh}
                                onAddToKnowledge={onAddToKnowledge}
                                forceCollapsed={forceCollapsed}
                                expandAllSignal={expandAllSignal}
                                collapseAllSignal={collapseAllSignal}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}
