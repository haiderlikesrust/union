'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import {
    KnowledgePage,
    KnowledgeSection,
    KnowledgeEntry,
    KNOWLEDGE_SECTION_KEYS,
    KnowledgeSectionKey,
} from '@/lib/types';
import { MarkdownWithMentions } from '@/components/ui/MarkdownWithMentions';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber, timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

const MIN_SCORE_TO_UNLOCK = 2;
const MIN_COMMENTS_TO_UNLOCK = 1;

export interface KnowledgeInitialAdd {
    sectionKey: KnowledgeSectionKey;
    content: string;
}

interface KnowledgeTabProps {
    postId: string;
    postScore: number;
    commentCount: number;
    /** When set, open the add form for this section with content pre-filled (e.g. from "Add to Knowledge" on a comment). */
    initialAdd?: KnowledgeInitialAdd | null;
    /** Call after initialAdd has been applied so the parent can clear it. */
    onInitialAddConsumed?: () => void;
}

export function KnowledgeTab({ postId, postScore, commentCount, initialAdd, onInitialAddConsumed }: KnowledgeTabProps) {
    const { pb, user } = useAuth();
    const [page, setPage] = useState<KnowledgePage | null>(null);
    const [sections, setSections] = useState<KnowledgeSection[]>([]);
    const [entriesBySection, setEntriesBySection] = useState<Record<string, KnowledgeEntry[]>>({});
    const [userVotes, setUserVotes] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [addingSectionId, setAddingSectionId] = useState<string | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editLinkUrl, setEditLinkUrl] = useState('');
    const [historyEntryId, setHistoryEntryId] = useState<string | null>(null);
    const [editHistory, setEditHistory] = useState<{ editor: string; description: string; created: string }[]>([]);
    const [editingSummary, setEditingSummary] = useState(false);
    const [summaryDraft, setSummaryDraft] = useState('');
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [prefillContent, setPrefillContent] = useState<string | null>(null);
    const [prefillSectionId, setPrefillSectionId] = useState<string | null>(null);

    const qualifies = postScore >= MIN_SCORE_TO_UNLOCK || commentCount >= MIN_COMMENTS_TO_UNLOCK;
    const clearPrefill = useCallback(() => {
        setPrefillContent(null);
        setPrefillSectionId(null);
    }, []);

    const fetchPage = useCallback(async () => {
        try {
            const list = await pb.collection('knowledge_pages').getList(1, 1, {
                filter: `post = "${postId}"`,
            });
            if (list.items.length > 0) {
                setPage(list.items[0] as unknown as KnowledgePage);
                return (list.items[0] as KnowledgePage).id;
            }
        } catch {
            // ignore
        }
        return null;
    }, [pb, postId]);

    const fetchSections = useCallback(async (pageId: string) => {
        const res = await pb.collection('knowledge_sections').getFullList({
            filter: `knowledgePage = "${pageId}"`,
            sort: 'order',
        });
        setSections(res as unknown as KnowledgeSection[]);
        return res as unknown as KnowledgeSection[];
    }, [pb]);

    const fetchEntries = useCallback(async (sectionIds: string[]) => {
        if (sectionIds.length === 0) return;
        const filter = sectionIds.map(s => `section = "${s}"`).join(' || ');
        const res = await pb.collection('knowledge_entries').getFullList({
            filter,
            sort: '-score,order,created',
            expand: 'author',
        });
        const entries = res as unknown as KnowledgeEntry[];
        const bySection: Record<string, KnowledgeEntry[]> = {};
        sectionIds.forEach(sid => { bySection[sid] = []; });
        entries.forEach(e => {
            if (!bySection[e.section]) bySection[e.section] = [];
            bySection[e.section].push(e);
        });
        setEntriesBySection(prev => ({ ...prev, ...bySection }));
    }, [pb]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const pageId = await fetchPage();
            if (pageId) {
                const secs = await fetchSections(pageId);
                const sectionIds = secs.map(s => s.id);
                const filter = sectionIds.map(s => `section = "${s}"`).join(' || ');
                const res = await pb.collection('knowledge_entries').getFullList({
                    filter,
                    sort: '-score,order,created',
                    expand: 'author',
                });
                const entries = res as unknown as KnowledgeEntry[];
                const bySection: Record<string, KnowledgeEntry[]> = {};
                sectionIds.forEach(sid => { bySection[sid] = []; });
                entries.forEach(e => {
                    if (!bySection[e.section]) bySection[e.section] = [];
                    bySection[e.section].push(e);
                });
                setEntriesBySection(bySection);
                if (user && entries.length > 0) {
                    const entryIds = entries.map(e => e.id);
                    const voteFilter = entryIds.map(id => `entry = "${id}"`).join(' || ');
                    const votesRes = await pb.collection('knowledge_votes').getFullList({
                        filter: `user = "${user.id}" && (${voteFilter})`,
                    });
                    const map: Record<string, number> = {};
                    (votesRes as unknown as { entry: string; value: number }[]).forEach(v => { map[v.entry] = v.value; });
                    setUserVotes(map);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [pb, postId, user, fetchPage, fetchSections]);

    useEffect(() => {
        load();
    }, [load]);

    // When initialAdd is provided (e.g. from "Add to Knowledge" on a comment), open that section's add form with content pre-filled
    useEffect(() => {
        if (!initialAdd || sections.length === 0) return;
        const section = sections.find(s => s.key === initialAdd.sectionKey);
        if (section) {
            setAddingSectionId(section.id);
            setPrefillContent(initialAdd.content);
            setPrefillSectionId(section.id);
            onInitialAddConsumed?.();
        }
    }, [initialAdd, sections, onInitialAddConsumed]);

    const createKnowledgePage = async () => {
        if (!user || !qualifies) return;
        setCreating(true);
        try {
            const newPage = await pb.collection('knowledge_pages').create({
                post: postId,
                threadSummary: '',
            }) as unknown as KnowledgePage;
            setPage(newPage);
            for (let i = 0; i < KNOWLEDGE_SECTION_KEYS.length; i++) {
                await pb.collection('knowledge_sections').create({
                    knowledgePage: newPage.id,
                    key: KNOWLEDGE_SECTION_KEYS[i].key,
                    title: KNOWLEDGE_SECTION_KEYS[i].title,
                    order: i,
                });
            }
            const secs = await fetchSections(newPage.id);
            await fetchEntries(secs.map(s => s.id));
            toast.success('Knowledge page created');
        } catch (e) {
            toast.error('Failed to create knowledge page');
        } finally {
            setCreating(false);
        }
    };

    const addEntry = async (sectionId: string, content: string, linkUrl?: string) => {
        if (!user || !content.trim()) return;
        setAddingSectionId(sectionId);
        try {
            await pb.collection('knowledge_entries').create({
                section: sectionId,
                content: content.trim(),
                linkUrl: linkUrl?.trim() || '',
                score: 0,
                order: 0,
                author: user.id,
            });
            const secs = sections.map(s => s.id);
            await fetchEntries(secs);
            toast.success('Added');
        } catch {
            toast.error('Failed to add');
        } finally {
            setAddingSectionId(null);
        }
    };

    const voteEntry = async (entryId: string, value: number) => {
        if (!user) return;
        try {
            const existing = userVotes[entryId];
            if (existing === value) return;
            const list = await pb.collection('knowledge_votes').getList(1, 1, {
                filter: `entry = "${entryId}" && user = "${user.id}"`,
            });
            const entry = Object.values(entriesBySection).flat().find(e => e.id === entryId);
            const oldVal = existing ?? 0;
            const delta = value - oldVal;
            if (list.items.length > 0) {
                await pb.collection('knowledge_votes').update(list.items[0].id, { value });
            } else {
                await pb.collection('knowledge_votes').create({ entry: entryId, user: user.id, value });
            }
            if (entry) {
                const newScore = Math.max(0, (entry.score || 0) + delta);
                await pb.collection('knowledge_entries').update(entryId, { score: newScore });
            }
            setUserVotes(prev => ({ ...prev, [entryId]: value }));
            const secs = sections.map(s => s.id);
            await fetchEntries(secs);
        } catch {
            // ignore
        }
    };

    const updateEntry = async (entryId: string) => {
        if (!editContent.trim()) return;
        try {
            await pb.collection('knowledge_entries').update(entryId, {
                content: editContent.trim(),
                linkUrl: editLinkUrl.trim() || '',
            });
            await pb.collection('knowledge_edits').create({
                entry: entryId,
                editor: user!.id,
                description: 'Updated content',
            });
            setEditingEntryId(null);
            const secs = sections.map(s => s.id);
            await fetchEntries(secs);
            toast.success('Updated');
        } catch {
            toast.error('Failed to update');
        }
    };

    const saveThreadSummary = async () => {
        if (!page) return;
        try {
            await pb.collection('knowledge_pages').update(page.id, { threadSummary: summaryDraft.trim() });
            setPage(prev => prev ? { ...prev, threadSummary: summaryDraft.trim() } : null);
            setEditingSummary(false);
            toast.success('Summary updated');
        } catch {
            toast.error('Failed to update summary');
        }
    };

    const generateAISummary = async () => {
        if (!page) return;
        setGeneratingSummary(true);
        try {
            const [postRec, commentsRes] = await Promise.all([
                pb.collection('posts').getOne(postId, { fields: 'title,body' }),
                pb.collection('comments').getList(1, 15, {
                    filter: `post = "${postId}"`,
                    sort: '-score,-created',
                    fields: 'content',
                }),
            ]);
            const title = (postRec as { title?: string }).title || '';
            const body = (postRec as { body?: string }).body || '';
            const commentsText = (commentsRes.items as { content?: string }[])
                .map((c, i) => `[${i + 1}] ${c.content || ''}`)
                .join('\n\n');
            const res = await fetch('/api/knowledge/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, commentsText }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || res.statusText);
            }
            const { summary } = await res.json();
            if (summary) {
                await pb.collection('knowledge_pages').update(page.id, { threadSummary: summary });
                setPage(prev => prev ? { ...prev, threadSummary: summary } : null);
                toast.success('Summary generated');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to generate summary');
        } finally {
            setGeneratingSummary(false);
        }
    };

    const loadEditHistory = async (entryId: string) => {
        setHistoryEntryId(entryId);
        try {
            const res = await pb.collection('knowledge_edits').getFullList({
                filter: `entry = "${entryId}"`,
                sort: '-created',
                expand: 'editor',
            });
            setEditHistory((res as any[]).map(r => ({
                editor: (r.expand?.editor as any)?.username || 'Unknown',
                description: r.description || 'Edit',
                created: r.created,
            })));
        } catch {
            setEditHistory([]);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (!page) {
        return (
            <div className="py-8">
                <EmptyState
                    title="Community Knowledge"
                    description={qualifies
                        ? 'This thread doesn\'t have a knowledge page yet. Create one to turn the best answers and resources into a structured wiki.'
                        : `Share more and discuss: this thread needs at least ${MIN_SCORE_TO_UNLOCK} upvotes or ${MIN_COMMENTS_TO_UNLOCK}+ comments to unlock the Knowledge page.`}
                />
                {qualifies && user && (
                    <div className="mt-4 flex justify-center">
                        <button
                            type="button"
                            onClick={createKnowledgePage}
                            disabled={creating}
                            className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-full transition-colors disabled:opacity-50"
                        >
                            {creating ? 'Creating...' : 'Create Knowledge Page'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const sectionDescription = (key: KnowledgeSectionKey) =>
        KNOWLEDGE_SECTION_KEYS.find(k => k.key === key)?.description ?? '';

    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h2 className="text-lg sm:text-xl font-bold text-text-primary mb-1">Community Knowledge</h2>
                <p className="text-sm text-text-muted">Structured summary and best answers from this thread. Add the best answers and resources below; others can vote and edit.</p>
            </div>

            <section>
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Thread Summary</h3>
                {editingSummary ? (
                    <div className="space-y-2">
                        <textarea
                            value={summaryDraft}
                            onChange={e => setSummaryDraft(e.target.value)}
                            className="w-full p-3 bg-bg-tertiary border border-border rounded-xl text-sm resize-none"
                            rows={4}
                            placeholder="Summarize the discussion..."
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={saveThreadSummary} className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg">Save</button>
                            <button type="button" onClick={() => { setEditingSummary(false); setSummaryDraft(page?.threadSummary || ''); }} className="px-3 py-1.5 text-text-muted text-sm">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-bg-tertiary rounded-xl border border-border markdown-content">
                        {page.threadSummary ? (
                            <MarkdownWithMentions content={page.threadSummary} />
                        ) : (
                            <p className="text-text-muted text-sm">No summary yet.</p>
                        )}
                        {user && (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <button type="button" onClick={() => { setSummaryDraft(page?.threadSummary || ''); setEditingSummary(true); }} className="text-xs text-accent hover:text-accent-hover">
                                    {page.threadSummary ? 'Edit summary' : 'Add summary'}
                                </button>
                                <button
                                    type="button"
                                    onClick={generateAISummary}
                                    disabled={generatingSummary}
                                    className="text-xs text-accent hover:text-accent-hover disabled:opacity-50"
                                >
                                    {generatingSummary ? 'Generating…' : 'Generate with AI'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {sections.filter(s => s.key !== 'thread_summary').map(section => {
                const entries = entriesBySection[section.id] || [];
                const isAdding = addingSectionId === section.id;
                const description = sectionDescription(section.key);
                return (
                    <section key={section.id} className="border border-border rounded-xl overflow-hidden bg-bg-secondary">
                        <div className="px-4 py-3 border-b border-border bg-bg-tertiary">
                            <h3 className="font-semibold text-text-primary">{section.title}</h3>
                            {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
                        </div>
                        <div className="divide-y divide-border">
                            {entries.length === 0 && !isAdding && (
                                <div className="p-6 text-center">
                                    <p className="text-sm text-text-muted mb-3">No entries yet.</p>
                                    {user ? (
                                        <button
                                            type="button"
                                            onClick={() => setAddingSectionId(section.id)}
                                            className="text-sm font-medium text-accent hover:text-accent-hover"
                                        >
                                            + Add first {section.key === 'best_resources' ? 'resource' : section.key === 'best_answers' ? 'answer' : 'entry'}
                                        </button>
                                    ) : (
                                        <p className="text-xs text-text-muted">Sign in to add.</p>
                                    )}
                                </div>
                            )}
                            {entries.map(entry => (
                                <div key={entry.id} className="p-4">
                                    {editingEntryId === entry.id ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={editContent}
                                                onChange={e => setEditContent(e.target.value)}
                                                className="w-full p-3 bg-bg-tertiary border border-border rounded-lg text-sm resize-none"
                                                rows={4}
                                            />
                                            {section.key === 'best_resources' && (
                                                <input
                                                    type="url"
                                                    value={editLinkUrl}
                                                    onChange={e => setEditLinkUrl(e.target.value)}
                                                    placeholder="URL"
                                                    className="w-full p-2 bg-bg-tertiary border border-border rounded-lg text-sm"
                                                />
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateEntry(entry.id)}
                                                    className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingEntryId(null); }}
                                                    className="px-3 py-1.5 text-text-muted text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 markdown-content text-sm text-text-secondary">
                                                    <MarkdownWithMentions content={entry.content} />
                                                    {entry.linkUrl && (
                                                        <a
                                                            href={entry.linkUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-accent hover:underline mt-1 inline-block"
                                                        >
                                                            {entry.linkUrl}
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => voteEntry(entry.id, 1)}
                                                        className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg sm:rounded ${userVotes[entry.id] === 1 ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                                                        title="Upvote"
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"> <path d="M2 10a1 1 0 011-1h3V4a1 1 0 011-1h6a1 1 0 011 1v5h3a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1v-6z" /> </svg>
                                                    </button>
                                                    <span className="text-xs text-text-muted min-w-[1.5rem] text-center">{formatNumber(entry.score || 0)}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => voteEntry(entry.id, -1)}
                                                        className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg sm:rounded ${userVotes[entry.id] === -1 ? 'text-danger bg-danger/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                                                        title="Downvote"
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"> <path d="M18 9a1 1 0 00-1-1h-3V3a1 1 0 00-1-1H6a1 1 0 00-1 1v5H2a1 1 0 00-1 1v6a1 1 0 001 1h3v5a1 1 0 001 1h6a1 1 0 001-1v-5h3a1 1 0 001-1V9z" /> </svg>
                                                    </button>
                                                    {user && (user.id === entry.author || (entry.expand?.author as any)?.id === user.id) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingEntryId(entry.id);
                                                                setEditContent(entry.content);
                                                                setEditLinkUrl(entry.linkUrl || '');
                                                            }}
                                                            className="p-1 text-text-muted hover:text-accent"
                                                            title="Edit"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {entry.expand?.author && (
                                                <p className="text-xs text-text-muted mt-1">
                                                    — {(entry.expand.author as any).username}
                                                </p>
                                            )}
                                            <div className="mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => historyEntryId === entry.id ? setHistoryEntryId(null) : loadEditHistory(entry.id)}
                                                    className="text-xs text-text-muted hover:text-accent"
                                                >
                                                    {historyEntryId === entry.id ? 'Hide history' : 'History'}
                                                </button>
                                                {historyEntryId === entry.id && (
                                                    <div className="mt-2 p-2 bg-bg-tertiary rounded-lg border border-border text-xs space-y-1">
                                                        {editHistory.length === 0 ? (
                                                            <p className="text-text-muted">No edit history</p>
                                                        ) : (
                                                            editHistory.map((h, i) => (
                                                                <div key={i} className="flex justify-between gap-2">
                                                                    <span className="text-text-secondary">{h.description}</span>
                                                                    <span className="text-text-muted shrink-0">{h.editor} · {timeAgo(h.created)}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {user && (
                                isAdding ? (
                                    <AddEntryForm
                                        sectionKey={section.key}
                                        initialContent={prefillSectionId === section.id ? prefillContent : undefined}
                                        initialLinkUrl={undefined}
                                        onAdd={(content, linkUrl) => {
                                            clearPrefill();
                                            addEntry(section.id, content, linkUrl);
                                        }}
                                        onCancel={() => {
                                            clearPrefill();
                                            setAddingSectionId(null);
                                        }}
                                        onInitialContentUsed={clearPrefill}
                                    />
                                ) : (
                                    <div className="p-4">
                                        <button
                                            type="button"
                                            onClick={() => setAddingSectionId(section.id)}
                                            className="text-sm text-accent hover:text-accent-hover min-h-[44px] px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
                                        >
                                            + Add to {section.title}
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function AddEntryForm({
    sectionKey,
    initialContent,
    initialLinkUrl,
    onAdd,
    onCancel,
    onInitialContentUsed,
}: {
    sectionKey: KnowledgeSectionKey;
    initialContent?: string | null;
    initialLinkUrl?: string | null;
    onAdd: (content: string, linkUrl?: string) => void;
    onCancel: () => void;
    onInitialContentUsed?: () => void;
}) {
    const [content, setContent] = useState(initialContent || '');
    const [linkUrl, setLinkUrl] = useState(initialLinkUrl || '');
    const isResource = sectionKey === 'best_resources';

    useEffect(() => {
        if (initialContent != null) {
            setContent(initialContent);
            onInitialContentUsed?.();
        }
    }, [initialContent, onInitialContentUsed]);

    return (
        <div className="p-4 space-y-2 border-t border-border">
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={isResource ? 'Description of the resource' : 'Your answer or note...'}
                className="w-full p-3 bg-bg-tertiary border border-border rounded-lg text-sm resize-none min-h-[80px]"
                rows={3}
            />
            {isResource && (
                <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 bg-bg-tertiary border border-border rounded-lg text-sm"
                />
            )}
            <div className="flex gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => { onAdd(content, linkUrl || undefined); setContent(''); setLinkUrl(''); }}
                    disabled={!content.trim()}
                    className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-50 min-h-[40px]"
                >
                    Add
                </button>
                <button type="button" onClick={onCancel} className="px-4 py-2 text-text-muted text-sm min-h-[40px] rounded-lg hover:bg-bg-hover">Cancel</button>
            </div>
        </div>
    );
}
