'use client';

import { FLAIR_OPTIONS } from '@/lib/types';

interface FlairBadgeProps {
    flair: string;
    size?: 'sm' | 'md';
    clickable?: boolean;
}

export function FlairBadge({ flair, size = 'sm', clickable = false }: FlairBadgeProps) {
    const flairData = FLAIR_OPTIONS.find(f => f.value === flair);
    if (!flairData) return null;

    const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold ${sizeClasses} ${clickable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
            style={{
                backgroundColor: flairData.color + '20',
                color: flairData.color,
            }}
        >
            {flairData.label}
        </span>
    );
}
