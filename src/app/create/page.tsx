'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { FlairBadge } from '@/components/ui/FlairBadge';
import { MentionTextarea } from '@/components/ui/MentionTextarea';
import { FLAIR_OPTIONS } from '@/lib/types';
import toast from 'react-hot-toast';

const DRAFT_KEY = 'the-union-create-draft';
const MAX_MEDIA_MB = 50;

function isVideoFile(file: File): boolean {
    return file.type.startsWith('video/');
}

export default function CreatePostPage() {
    const { pb, user } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [flair, setFlair] = useState('');
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [isVideo, setIsVideo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!user) {
        router.push('/login');
        return null;
    }

    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw) as { title?: string; body?: string; flair?: string };
            if (draft.title) setTitle(draft.title);
            if (draft.body) setBody(draft.body);
            if (draft.flair) setFlair(draft.flair);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, flair }));
    }, [title, body, flair]);

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const maxBytes = MAX_MEDIA_MB * 1024 * 1024;
        if (file.size > maxBytes) {
            toast.error(`File must be under ${MAX_MEDIA_MB}MB`);
            return;
        }
        const video = isVideoFile(file);
        setIsVideo(video);
        setMediaFile(file);
        if (video) {
            setMediaPreview(URL.createObjectURL(file));
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const clearMedia = () => {
        if (mediaPreview && isVideo) URL.revokeObjectURL(mediaPreview);
        setMediaPreview(null);
        setMediaFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('type', mediaFile ? 'image' : 'text');
            formData.append('author', user.id);
            formData.append('score', '0');
            formData.append('commentCount', '0');
            formData.append('isPinned', 'false');
            formData.append('isLocked', 'false');
            formData.append('body', body);
            if (flair) formData.append('flair', flair);
            if (mediaFile) formData.append('image', mediaFile);

            const post = await pb.collection('posts').create(formData);
            localStorage.removeItem(DRAFT_KEY);
            toast.success('Post created!');
            router.push(`/post/${post.id}`);
        } catch (err) {
            toast.error('Failed to create post');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <h1 className="text-2xl font-bold mb-6">Create Post</h1>

                    <div className="bg-bg-secondary rounded-2xl border border-border overflow-hidden">
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Post title"
                                maxLength={300}
                                className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none text-lg transition-colors"
                                required
                            />

                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Flair (optional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {FLAIR_OPTIONS.map(f => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setFlair(flair === f.value ? '' : f.value)}
                                            className={`transition-all ${flair === f.value ? 'ring-2 ring-offset-2 ring-offset-bg-secondary rounded-full' : 'opacity-60 hover:opacity-100'}`}
                                            style={flair === f.value ? { ringColor: f.color } as React.CSSProperties : {}}
                                        >
                                            <FlairBadge flair={f.value} size="md" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <MentionTextarea
                                value={body}
                                onChange={setBody}
                                placeholder="What's on your mind? Add text, and optionally attach an image or video below. Markdown supported, type @ to mention users."
                                rows={6}
                                className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none resize-none transition-colors"
                            />

                            {/* Optional image or video */}
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleMediaSelect}
                                    className="hidden"
                                />
                                {mediaPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border border-border">
                                        {isVideo ? (
                                            <video
                                                src={mediaPreview}
                                                controls
                                                className="w-full max-h-[400px] bg-black"
                                                preload="metadata"
                                            />
                                        ) : (
                                            <img src={mediaPreview} alt="Preview" className="w-full max-h-[400px] object-contain bg-black" />
                                        )}
                                        <button
                                            type="button"
                                            onClick={clearMedia}
                                            className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-10 border-2 border-dashed border-border rounded-xl text-text-muted hover:border-accent hover:text-accent transition-all flex flex-col items-center gap-2"
                                    >
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm font-medium">Add image or video (optional)</span>
                                        <span className="text-xs">Max {MAX_MEDIA_MB}MB</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => toast.success('Draft saved')}
                                        className="px-3 py-2 text-xs text-text-muted hover:text-text-primary border border-border rounded-lg hover:bg-bg-hover transition-colors"
                                    >
                                        Save draft
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            localStorage.removeItem(DRAFT_KEY);
                                            setTitle('');
                                            setBody('');
                                            setFlair('');
                                            clearMedia();
                                            toast.success('Draft cleared');
                                        }}
                                        className="px-3 py-2 text-xs text-text-muted hover:text-text-primary border border-border rounded-lg hover:bg-bg-hover transition-colors"
                                    >
                                        Clear draft
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title.trim()}
                                    className="px-8 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-full transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-accent/20"
                                >
                                    {isSubmitting ? 'Posting...' : 'Post'}
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
