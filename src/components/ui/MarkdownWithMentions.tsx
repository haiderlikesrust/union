'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Turns @username into markdown links so they render as profile links */
export function linkifyMentions(text: string): string {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/@(\w+)/g, '[@$1](/user/$1)');
}

/** Renders markdown with @mentions as Next.js Links to user profiles */
export function MarkdownWithMentions({ content, className }: { content: string; className?: string }) {
    const linkify = linkifyMentions(content);
    return (
        <span className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => {
                        if (href?.startsWith('/')) {
                            return (
                                <Link href={href} className="text-accent hover:text-accent-hover underline" onClick={(e) => e.stopPropagation()}>
                                    {children}
                                </Link>
                            );
                        }
                        return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover underline">
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {linkify}
            </ReactMarkdown>
        </span>
    );
}
