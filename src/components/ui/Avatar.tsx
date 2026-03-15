'use client';

import { User } from '@/lib/types';
import { getRecordFileUrl } from '@/lib/pocketbase';
import { getInitials, stringToColor } from '@/lib/utils';

interface AvatarProps {
    user: User | null | undefined;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
    full: 'w-full h-full text-4xl',
};

export function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
    const sizeClass = sizeMap[size];
    const username = user?.username || '?';

    if (user?.avatar) {
        const url = getRecordFileUrl(
            { id: user.id, collectionId: user.collectionId, collectionName: user.collectionName },
            user.avatar
        );
        return (
            <img
                src={url}
                alt={username}
                className={`${sizeClass} rounded-full object-cover ring-2 ring-border ${className}`}
            />
        );
    }

    return (
        <div
            className={`${sizeClass} rounded-full flex items-center justify-center font-bold ring-2 ring-border ${className}`}
            style={{ backgroundColor: stringToColor(username) }}
        >
            {getInitials(username)}
        </div>
    );
}
