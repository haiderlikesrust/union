'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { FLAIR_OPTIONS } from '@/lib/types';
import { FlairBadge } from '@/components/ui/FlairBadge';
import toast from 'react-hot-toast';

export default function EditPostPage() {
    const { id } = useParams<{ id: string }>();
    const { pb, user } = useAuth();
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('');
    const [flair, setFlair] = useState('');
    const [type, setType] = useState('text');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const post = await pb.collection('posts').getOne(id);
                if (post.author !== user?.id) {
                    toast.error('You can only edit your own posts');
                    router.push(`/post/${id}`);
                    return;
                }
                setTitle(post.title);
                setBody(post.body || '');
                setUrl(post.url || '');
                setFlair(post.flair || '');
                setType(post.type);
            } catch {
                toast.error('Post not found');
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        }
        if (user) load();
    }, [pb, id, user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data: Record<string, string> = { title: title.trim(), flair };
            if (type === 'text') data.body = body;
            if (type === 'link') data.url = url;

            await pb.collection('posts').update(id, data);
            toast.success('Post updated');
            router.push(`/post/${id}`);
        } catch {
            toast.error('Failed to update post');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <>
                <Navbar />
                <main className="pt-14 flex items-center justify-center min-h-screen">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <h1 className="text-2xl font-bold mb-6">Edit Post</h1>

                    <div className="bg-bg-secondary rounded-2xl border border-border p-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary focus:border-accent focus:outline-none text-lg"
                                required
                            />

                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Flair</label>
                                <div className="flex flex-wrap gap-2">
                                    {FLAIR_OPTIONS.map(f => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setFlair(flair === f.value ? '' : f.value)}
                                            className={`transition-all ${flair === f.value ? 'ring-2 ring-offset-2 ring-offset-bg-secondary rounded-full' : 'opacity-60 hover:opacity-100'}`}
                                        >
                                            <FlairBadge flair={f.value} size="md" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {type === 'text' && (
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={8}
                                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary focus:border-accent focus:outline-none resize-none"
                                />
                            )}

                            {type === 'link' && (
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary focus:border-accent focus:outline-none"
                                />
                            )}

                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="px-6 py-2.5 text-text-muted hover:text-text-primary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-8 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
            <MobileNav />
        </>
    );
}
