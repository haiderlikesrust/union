'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Post, SavedPost } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { PostCard } from '@/components/posts/PostCard';
import { PostCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

export default function SavedPostsPage() {
    const { pb, user } = useAuth();
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) { router.push('/login'); return; }

        async function load() {
            try {
                const saved = await pb.collection('saved_posts').getFullList({
                    filter: `user = "${user!.id}"`,
                    sort: '-created',
                    expand: 'post,post.author,post.author.badges,post.badges',
                });

                const savedPosts = saved
                    .map(s => (s.expand as any)?.post)
                    .filter(Boolean)
                    .map((p: any) => ({
                        ...p,
                        expand: { author: p.expand?.author },
                    }));

                setPosts(savedPosts);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [pb, user, router]);

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <h1 className="text-2xl font-bold mb-6">Saved Posts</h1>

                    {isLoading ? (
                        <div className="space-y-3">
                            <PostCardSkeleton />
                            <PostCardSkeleton />
                        </div>
                    ) : posts.length > 0 ? (
                        <div className="space-y-3">
                            {posts.map(post => (
                                <PostCard key={post.id} post={post} isSaved />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No saved posts"
                            description="Posts you save will appear here for easy access."
                            action={
                                <Link href="/" className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-full text-sm font-medium">
                                    Browse Posts
                                </Link>
                            }
                        />
                    )}
                </div>
            </main>
            <MobileNav />
        </>
    );
}
