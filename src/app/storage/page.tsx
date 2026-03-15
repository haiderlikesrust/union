'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { USER_STORAGE_QUOTA_BYTES } from '@/lib/types';
import JSZip from 'jszip';

type StorageItem = {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    created: string;
    file: string;
};

type StorageResponse = {
    items: StorageItem[];
    usedBytes: number;
    quotaBytes: number;
};

type FilterType = 'all' | 'images' | 'documents' | 'other';
type SortOption = 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'largest' | 'smallest';

function formatBytes(n: number): string {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KB';
    return n + ' B';
}

function formatDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
    } catch {
        return iso;
    }
}

function getAuthHeaders(pb: ReturnType<typeof useAuth>['pb']): HeadersInit {
    const token = pb.authStore.token;
    return { Authorization: token ? `Bearer ${token}` : '' };
}

function getFileCategory(mimeType: string): FilterType {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('sheet')) return 'documents';
    return 'other';
}

export default function StoragePage() {
    const { user, pb, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<StorageResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [sort, setSort] = useState<SortOption>('newest');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [savingRename, setSavingRename] = useState(false);
    const [bulkDownloading, setBulkDownloading] = useState(false);

    const fetchList = useCallback(async () => {
        if (!user) return;
        try {
            const list = (await pb.collection('user_storage').getFullList({
                filter: `user = "${user.id}"`,
                sort: '-created',
            })) as unknown as Array<Record<string, unknown>>;
            const items: StorageItem[] = (list || []).map((r) => ({
                id: String(r.id ?? ''),
                name: String(r.name ?? ''),
                size: Number(r.size ?? 0),
                mimeType: String(r.mimeType ?? ''),
                created: String(r.created ?? ''),
                file: String(r.file ?? ''),
            }));
            const usedBytes = items.reduce((sum, i) => sum + i.size, 0);
            setData({ items, usedBytes, quotaBytes: USER_STORAGE_QUOTA_BYTES });
        } catch {
            toast.error('Failed to load storage');
            setData({ items: [], usedBytes: 0, quotaBytes: USER_STORAGE_QUOTA_BYTES });
        } finally {
            setLoading(false);
        }
    }, [user, pb]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        fetchList();
    }, [authLoading, user, router, fetchList]);

    const filteredAndSortedItems = useMemo(() => {
        if (!data?.items) return [];
        let list = data.items;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((i) => i.name.toLowerCase().includes(q));
        }
        if (filter !== 'all') {
            list = list.filter((i) => getFileCategory(i.mimeType) === filter);
        }
        const sorted = [...list].sort((a, b) => {
            switch (sort) {
                case 'name-asc': return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                case 'name-desc': return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
                case 'newest': return new Date(b.created).getTime() - new Date(a.created).getTime();
                case 'oldest': return new Date(a.created).getTime() - new Date(b.created).getTime();
                case 'largest': return b.size - a.size;
                case 'smallest': return a.size - b.size;
                default: return 0;
            }
        });
        return sorted;
    }, [data?.items, search, filter, sort]);

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === filteredAndSortedItems.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredAndSortedItems.map((i) => i.id)));
    };

    const handleUpload = async (files: FileList | File[]) => {
        if (!user || !pb.authStore.token || uploading) return;
        const list = Array.isArray(files) ? files : Array.from(files);
        if (list.length === 0) return;

        setUploading(true);
        let ok = 0;
        let fail = 0;
        const total = list.length;
        for (let idx = 0; idx < list.length; idx++) {
            const file = list[idx];
            setUploadProgress(Math.round((idx / total) * 100));
            try {
                const form = new FormData();
                form.append('file', file);
                form.append('authToken', pb.authStore.token);
                const res = await fetch('/api/storage/upload', {
                    method: 'POST',
                    headers: getAuthHeaders(pb),
                    body: form,
                });
                if (res.ok) ok++;
                else {
                    const err = (await res.json()).error || 'Upload failed';
                    if (res.status === 413) {
                        toast.error(err);
                        fail++;
                        break;
                    }
                    fail++;
                }
            } catch {
                fail++;
            }
        }
        setUploadProgress(null);
        setUploading(false);
        if (ok) {
            toast.success(ok === 1 ? 'File uploaded' : `${ok} files uploaded`);
            fetchList();
        }
        if (fail) toast.error(fail === 1 ? 'One file failed' : `${fail} files failed`);
    };

    const handleDelete = async (id: string) => {
        if (deletingId) return;
        setDeletingId(id);
        try {
            await pb.collection('user_storage').delete(id);
            setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
            if (previewItem?.id === id) setPreviewItem(null);
            toast.success('Deleted');
            fetchList();
        } catch {
            toast.error('Failed to delete');
        } finally {
            setDeletingId(null);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const ids = [...selectedIds];
        setDeletingId(ids[0]);
        let done = 0;
        for (const id of ids) {
            try {
                await pb.collection('user_storage').delete(id);
                done++;
            } catch {
                toast.error(`Failed to delete some files`);
            }
        }
        setDeletingId(null);
        setSelectedIds(new Set());
        setPreviewItem(null);
        toast.success(`${done} file(s) deleted`);
        fetchList();
    };

    const handleDownload = (id: string, name: string) => {
        fetch(`/api/storage/${id}`, { headers: getAuthHeaders(pb) })
            .then((r) => {
                if (!r.ok) throw new Error('Download failed');
                return r.blob();
            })
            .then((blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = name || 'download';
                a.click();
                URL.revokeObjectURL(a.href);
            })
            .catch(() => toast.error('Download failed'));
    };

    const handleBulkDownload = async () => {
        if (selectedIds.size === 0) return;
        setBulkDownloading(true);
        try {
            const zip = new JSZip();
            const items = filteredAndSortedItems.filter((i) => selectedIds.has(i.id));
            for (const item of items) {
                const res = await fetch(`/api/storage/${item.id}`, { headers: getAuthHeaders(pb) });
                if (!res.ok) continue;
                const blob = await res.blob();
                zip.file(item.name, blob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(zipBlob);
            a.download = `storage-${new Date().toISOString().slice(0, 10)}.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success('Download started');
        } catch {
            toast.error('Bulk download failed');
        } finally {
            setBulkDownloading(false);
        }
    };

    const handleRename = async (id: string, newName: string) => {
        if (!newName.trim() || newName === previewItem?.name) return;
        setSavingRename(true);
        try {
            const res = await fetch(`/api/storage/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders(pb) },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Rename failed');
            const { name } = await res.json();
            setPreviewItem((p) => (p && p.id === id ? { ...p, name } : p));
            setData((d) => d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, name } : i)) } : d);
            setRenameValue('');
            toast.success('Renamed');
        } catch {
            toast.error('Rename failed');
        } finally {
            setSavingRename(false);
        }
    };

    const openPreview = useCallback((item: StorageItem) => {
        setPreviewItem(item);
        setRenameValue(item.name);
        setPreviewBlobUrl(null);
        if (item.mimeType.startsWith('image/')) {
            fetch(`/api/storage/${item.id}`, { headers: getAuthHeaders(pb) })
                .then((r) => r.ok ? r.blob() : null)
                .then((blob) => blob && setPreviewBlobUrl(URL.createObjectURL(blob)))
                .catch(() => {});
        }
    }, [pb]);

    useEffect(() => {
        return () => {
            if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        };
    }, [previewBlobUrl]);

    if (authLoading) {
        return (
            <>
                <Navbar />
                <main className="pt-14 pb-20 md:pb-4 min-h-screen flex items-center justify-center">
                    <Skeleton className="h-12 w-64 rounded-xl" />
                </main>
                <MobileNav />
            </>
        );
    }
    if (!user) return null;

    const used = data?.usedBytes ?? 0;
    const quota = data?.quotaBytes ?? USER_STORAGE_QUOTA_BYTES;
    const percent = quota ? Math.min(100, (used / quota) * 100) : 0;

    return (
        <>
            <Navbar />
            <main className="pt-14 pb-20 md:pb-4 min-h-screen">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Cloud storage</h1>
                            <p className="text-sm text-text-muted mt-0.5">
                                5GB encrypted · Search, filter, bulk actions, preview
                            </p>
                        </div>
                    </div>

                    {/* Quota */}
                    <div className="mb-6 p-4 bg-bg-secondary border border-border rounded-xl">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-text-secondary">Used</span>
                            <span className="text-text-primary font-medium">
                                {formatBytes(used)} / {formatBytes(quota)}
                            </span>
                        </div>
                        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>

                    {/* Upload zone */}
                    <div
                        className={`mb-6 border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                            dragOver ? 'border-accent bg-bg-tertiary' : 'border-border bg-bg-secondary'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            handleUpload(e.dataTransfer.files);
                        }}
                    >
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            id="storage-upload"
                            onChange={(e) => {
                                const f = e.target.files;
                                if (f?.length) handleUpload(f);
                                e.target.value = '';
                            }}
                        />
                        <label htmlFor="storage-upload" className="cursor-pointer block">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-bg-tertiary border border-border flex items-center justify-center text-text-muted">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <p className="text-text-primary font-medium">
                                {uploading ? `Uploading… ${uploadProgress != null ? uploadProgress + '%' : ''}` : 'Drop files or click to upload'}
                            </p>
                            {uploadProgress != null && (
                                <div className="mt-2 h-1.5 max-w-xs mx-auto bg-bg-tertiary rounded-full overflow-hidden">
                                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            )}
                        </label>
                    </div>

                    {/* Toolbar: search, filter, sort, view, bulk */}
                    {data?.items && data.items.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <input
                                type="search"
                                placeholder="Search files..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={
                                    'flex-1 min-w-36 px-3 py-2 rounded-lg bg-bg-tertiary border border-border ' +
                                    'text-text-primary placeholder:text-text-muted text-sm focus:border-accent focus:outline-none'
                                }
                            />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as FilterType)}
                                className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-text-primary text-sm focus:border-accent focus:outline-none"
                            >
                                <option value="all">All types</option>
                                <option value="images">Images</option>
                                <option value="documents">Documents</option>
                                <option value="other">Other</option>
                            </select>
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SortOption)}
                                className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-text-primary text-sm focus:border-accent focus:outline-none"
                            >
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="name-asc">Name A-Z</option>
                                <option value="name-desc">Name Z-A</option>
                                <option value="largest">Largest first</option>
                                <option value="smallest">Smallest first</option>
                            </select>
                            <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-bg-tertiary">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'}`}
                                    title="List view"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'}`}
                                    title="Grid view"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM16 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 012-2zM16 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2a2 2 0 012-2z" /></svg>
                                </button>
                            </div>
                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-sm text-text-muted">{selectedIds.size} selected</span>
                                    <button
                                        type="button"
                                        onClick={handleBulkDownload}
                                        disabled={bulkDownloading}
                                        className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border text-text-primary text-sm font-medium disabled:opacity-50"
                                    >
                                        {bulkDownloading ? 'Preparing…' : 'Download ZIP'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBulkDelete}
                                        className="px-3 py-1.5 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger border border-danger/40 text-sm font-medium"
                                    >
                                        Delete selected
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIds(new Set())}
                                        className="px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border text-text-muted text-sm"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Select all (when there are items) */}
                    {filteredAndSortedItems.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                                    onChange={selectAll}
                                    className="rounded border-border text-accent focus:ring-accent"
                                />
                                Select all on page
                            </label>
                        </div>
                    )}

                    {/* List or Grid */}
                    {loading ? (
                        <Skeleton className="h-48 w-full rounded-xl" />
                    ) : !filteredAndSortedItems.length ? (
                        <EmptyState
                            title={data?.items?.length ? 'No matching files' : 'No files yet'}
                            description={data?.items?.length ? 'Try a different search or filter.' : 'Upload files. They’re encrypted and only you can access or delete them.'}
                        />
                    ) : viewMode === 'list' ? (
                        <ul className="space-y-2">
                            {filteredAndSortedItems.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 p-4 bg-bg-secondary border border-border rounded-xl hover:bg-bg-hover transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="rounded border-border text-accent focus:ring-accent shrink-0"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openPreview(item)}
                                        className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center shrink-0 text-text-muted hover:text-text-primary"
                                    >
                                        {item.mimeType?.startsWith('image/') ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-text-primary font-medium truncate">{item.name}</p>
                                        <p className="text-xs text-text-muted">{formatBytes(item.size)} · {formatDate(item.created)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button type="button" onClick={() => handleDownload(item.id, item.name)} className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border" title="Download">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>
                                        <button type="button" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="p-2 rounded-lg bg-bg-tertiary hover:bg-danger/20 text-text-muted hover:text-danger border border-border disabled:opacity-50" title="Delete">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {filteredAndSortedItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-bg-secondary border border-border rounded-xl overflow-hidden hover:bg-bg-hover transition-colors flex flex-col"
                                >
                                    <div className="p-2 flex items-center gap-2 border-b border-border">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => toggleSelect(item.id)}
                                            className="rounded border-border text-accent focus:ring-accent shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => openPreview(item)}
                                            className="flex-1 min-w-0 flex items-center justify-center aspect-square bg-bg-tertiary rounded-lg border border-border text-text-muted"
                                        >
                                            {item.mimeType?.startsWith('image/') ? (
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                                            ) : (
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            )}
                                        </button>
                                    </div>
                                    <div className="p-2 flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate" title={item.name}>{item.name}</p>
                                        <p className="text-xs text-text-muted">{formatBytes(item.size)}</p>
                                    </div>
                                    <div className="p-2 flex gap-1 border-t border-border">
                                        <button type="button" onClick={() => handleDownload(item.id, item.name)} className="flex-1 p-1.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border" title="Download">
                                            <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </button>
                                        <button type="button" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="flex-1 p-1.5 rounded bg-bg-tertiary hover:bg-danger/20 text-text-muted hover:text-danger border border-border disabled:opacity-50" title="Delete">
                                            <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Preview / details modal */}
            {previewItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                    onClick={() => setPreviewItem(null)}
                >
                    <div
                        className="bg-bg-elevated border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
                        style={{ maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold text-text-primary truncate">{previewItem.name}</h3>
                            <button type="button" onClick={() => setPreviewItem(null)} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {previewBlobUrl && previewItem.mimeType.startsWith('image/') ? (
                                <img src={previewBlobUrl} alt={previewItem.name} className="max-w-full h-auto rounded-lg mx-auto" />
                            ) : (
                                <div className="flex items-center justify-center aspect-video bg-bg-tertiary rounded-xl border border-border text-text-muted">
                                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                            )}
                            <dl className="mt-4 space-y-2 text-sm">
                                <div><dt className="text-text-muted">Size</dt><dd className="text-text-primary font-medium">{formatBytes(previewItem.size)}</dd></div>
                                <div><dt className="text-text-muted">Type</dt><dd className="text-text-primary font-medium">{previewItem.mimeType || '—'}</dd></div>
                                <div><dt className="text-text-muted">Uploaded</dt><dd className="text-text-primary font-medium">{formatDate(previewItem.created)}</dd></div>
                            </dl>
                            <div className="mt-4">
                                <label className="block text-xs font-medium text-text-muted mb-1">Rename</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-text-primary text-sm focus:border-accent focus:outline-none"
                                        placeholder="File name"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRename(previewItem.id, renameValue)}
                                        disabled={savingRename || !renameValue.trim() || renameValue.trim() === previewItem.name}
                                        className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium disabled:opacity-50"
                                    >
                                        {savingRename ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex gap-2">
                            <button
                                type="button"
                                onClick={() => { handleDownload(previewItem.id, previewItem.name); setPreviewItem(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm"
                            >
                                Download
                            </button>
                            <button
                                type="button"
                                onClick={() => { handleDelete(previewItem.id); setPreviewItem(null); }}
                                disabled={deletingId === previewItem.id}
                                className="py-2.5 px-4 rounded-xl bg-bg-tertiary hover:bg-danger/20 text-danger border border-border font-medium text-sm disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MobileNav />
        </>
    );
}
