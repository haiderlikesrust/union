'use client';

import { formatNumber } from '@/lib/utils';

interface VoteButtonsProps {
    score: number;
    currentVote: number;
    onUpvote: () => void;
    onDownvote: () => void;
    horizontal?: boolean;
    size?: 'sm' | 'md';
}

export function VoteButtons({ score, currentVote, onUpvote, onDownvote, horizontal = false, size = 'md' }: VoteButtonsProps) {
    const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const buttonSize = size === 'sm' ? 'p-0.5' : 'p-1';

    return (
        <div className={`flex items-center gap-0.5 ${horizontal ? 'flex-row' : 'flex-col'}`}>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpvote(); }}
                className={`${buttonSize} rounded-md transition-all hover:scale-110 active:scale-95 ${currentVote === 1
                        ? 'text-upvote bg-upvote/10'
                        : 'text-text-muted hover:text-upvote hover:bg-upvote/5'
                    }`}
                title="Upvote"
            >
                <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4l-8 8h5v8h6v-8h5z" />
                </svg>
            </button>
            <span className={`font-semibold tabular-nums text-center min-w-[2ch] ${size === 'sm' ? 'text-xs' : 'text-sm'
                } ${currentVote === 1 ? 'text-upvote' : currentVote === -1 ? 'text-downvote' : 'text-text-secondary'
                }`}>
                {formatNumber(score)}
            </span>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDownvote(); }}
                className={`${buttonSize} rounded-md transition-all hover:scale-110 active:scale-95 ${currentVote === -1
                        ? 'text-downvote bg-downvote/10'
                        : 'text-text-muted hover:text-downvote hover:bg-downvote/5'
                    }`}
                title="Downvote"
            >
                <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 20l8-8h-5V4H9v8H4z" />
                </svg>
            </button>
        </div>
    );
}
