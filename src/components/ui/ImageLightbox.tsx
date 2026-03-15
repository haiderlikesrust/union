'use client';

import { useState, useEffect } from 'react';

interface ImageLightboxProps {
    src: string;
    alt: string;
    className?: string;
    /** Optional: element to use as trigger (click opens lightbox). If not provided, an img is used. */
    children?: React.ReactNode;
}

export function ImageLightbox({ src, alt, className, children }: ImageLightboxProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('keydown', onEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onEscape);
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(true);
                }}
                className={children ? 'block cursor-zoom-in' : undefined}
            >
                {children ?? (
                    <img
                        src={src}
                        alt={alt}
                        className={className}
                        loading="lazy"
                    />
                )}
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image preview"
                    onClick={() => setOpen(false)}
                >
                    <button
                        type="button"
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        onClick={() => setOpen(false)}
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={src}
                        alt={alt}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
