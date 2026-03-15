'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { FlairBadge } from '@/components/ui/FlairBadge';
import { MentionTextarea } from '@/components/ui/MentionTextarea';
import { FLAIR_OPTIONS, PostType } from '@/lib/types';
import { isValidUrl } from '@/lib/utils';
import toast from 'react-hot-toast';

const POST_TYPES: { value: PostType; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: 'Text', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { value: 'image', label: 'Image', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { value: 'link', label: 'Link', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
];

const DRAFT_KEY = 'the-union-create-draft';

export default function CreatePostPage() {
    const { pb, user } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [type, setType] = useState<PostType>('text');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('');
    const [flair, setFlair] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [duplicatePostId, setDuplicatePostId] = useState<string | null>(null);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    if (!user) {
        router.push('/login');
        return null;
    }

    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw) as { type?: PostType; title?: string; body?: string; url?: string; flair?: string };
            if (draft.type) setType(draft.type);
            if (draft.title) setTitle(draft.title);
            if (draft.body) setBody(draft.body);
            if (draft.url) setUrl(draft.url);
            if (draft.flair) setFlair(draft.flair);
        } catch {
            // ignore malformed drafts
        }
    }, []);

    useEffect(() => {
        const payload = JSON.stringify({ type, title, body, url, flair });
        localStorage.setItem(DRAFT_KEY, payload);
    }, [type, title, body, url, flair]);

    useEffect(() => {
        const check = async () => {
            if (type !== 'link' || !url.trim() || !isValidUrl(url.trim())) {
                setDuplicatePostId(null);
                return;
            }
            setCheckingDuplicate(true);
            try {
                const found = await pb.collection('posts').getFirstListItem(`url = "${url.trim()}"`, { fields: 'id' });
                setDuplicatePostId(found?.id ?? null);
            } catch {
                setDuplicatePostId(null);
            } finally {
                setCheckingDuplicate(false);
            }
        };
        const t = setTimeout(check, 350);
        return () => clearTimeout(t);
    }, [type, url, pb]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image must be under 10MB');
            return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { toast.error('Title is required'); return; }
        if (type === 'link' && !isValidUrl(url)) { toast.error('Please enter a valid URL'); return; }
        if (type === 'image' && !imageFile) { toast.error('Please select an image'); return; }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('type', type);
            formData.append('author', user.id);
            formData.append('score', '0');
            formData.append('commentCount', '0');
            formData.append('isPinned', 'false');
            formData.append('isLocked', 'false');
            if (flair) formData.append('flair', flair);

            if (type === 'text') {
                formData.append('body', body);
            } else if (type === 'image' && imageFile) {
                formData.append('image', imageFile);
            } else if (type === 'link') {
                formData.append('url', url);
            }

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
                        {/* Type Selector */}
                        <div className="flex border-b border-border">
                            {POST_TYPES.map(pt => (
                                <button
                                    key={pt.value}
                                    onClick={() => setType(pt.value)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all border-b-2 ${type === pt.value
                                        ? 'border-accent text-accent bg-accent/5'
                                        : 'border-transparent text-text-muted hover:text-text-primary hover:bg-bg-hover'
                                        }`}
                                >
                                    <span>{pt.icon}</span>
                                    {pt.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Title */}
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Post title"
                                maxLength={300}
                                className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none text-lg transition-colors"
                                required
                            />

                            {/* Flair */}
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

                            {/* Text body */}
                            {type === 'text' && (
                                <MentionTextarea
                                    value={body}
                                    onChange={setBody}
                                    placeholder="What's on your mind? (Markdown supported, type @ to mention users)"
                                    rows={8}
                                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none resize-none transition-colors"
                                />
                            )}

                            {/* Image upload */}
                            {type === 'image' && (
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                    />
                                    {imagePreview ? (
                                        <div className="relative rounded-xl overflow-hidden border border-border">
                                            <img src={imagePreview} alt="Preview" className="w-full max-h-[400px] object-contain bg-black" />
                                            <button
                                                type="button"
                                                onClick={() => { setImagePreview(null); setImageFile(null); }}
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
                                            className="w-full py-16 border-2 border-dashed border-border rounded-xl text-text-muted hover:border-accent hover:text-accent transition-all flex flex-col items-center gap-2"
                                        >
                                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-sm font-medium">Click to upload image</span>
                                            <span className="text-xs">Max 10MB</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Link URL */}
                            {type === 'link' && (
                                <div className="space-y-2">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://example.com"
                                        className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                                        required
                                    />
                                    {checkingDuplicate && (
                                        <p className="text-xs text-text-muted">Checking for duplicates...</p>
                                    )}
                                    {duplicatePostId && (
                                        <p className="text-xs text-warning">
                                            This link was already posted.{' '}
                                            <a href={`/post/${duplicatePostId}`} className="text-accent hover:text-accent-hover">
                                                View existing post
                                            </a>
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Submit */}
                            <div className="flex justify-between items-center pt-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, title, body, url, flair }));
                                            toast.success('Draft saved');
                                        }}
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
                                            setUrl('');
                                            setFlair('');
                                            setType('text');
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
