'use client';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return <div className={`skeleton rounded-lg ${className}`} />;
}

export function PostCardSkeleton() {
    return (
        <div className="bg-bg-secondary rounded-xl border border-border p-4 animate-fadeIn">
            <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1 w-10 shrink-0">
                    <Skeleton className="w-6 h-6 rounded" />
                    <Skeleton className="w-8 h-4" />
                    <Skeleton className="w-6 h-6 rounded" />
                </div>
                <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="w-24 h-3" />
                        <Skeleton className="w-16 h-3" />
                    </div>
                    <Skeleton className="w-3/4 h-5" />
                    <Skeleton className="w-full h-3" />
                    <Skeleton className="w-2/3 h-3" />
                    <div className="flex gap-3 pt-2">
                        <Skeleton className="w-20 h-7 rounded-full" />
                        <Skeleton className="w-16 h-7 rounded-full" />
                        <Skeleton className="w-14 h-7 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CommentSkeleton() {
    return (
        <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-20 h-3" />
            </div>
            <Skeleton className="w-full h-3" />
            <Skeleton className="w-4/5 h-3" />
        </div>
    );
}
