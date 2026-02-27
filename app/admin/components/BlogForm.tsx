"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TiptapEditor from "./TiptapEditor";
import ImageUpload from "./ImageUpload";

// Max synopsis length enforced in UI and DB
const SYNOPSIS_MAX = 160;

// Auto-save debounce delay in milliseconds (2 seconds after last change)
const AUTO_SAVE_DEBOUNCE = 2_000;

interface BlogFormProps {
    /** Unique key for localStorage draft (e.g. "blog-new" or "blog-{id}") */
    draftKey: string;
    initial?: {
        title: string;
        synopsis: string;
        cover_image_url: string | null;
        content: string;
        published: boolean;
    };
    onSubmit: (data: {
        title: string;
        synopsis: string;
        cover_image_url: string | null;
        content: string;
        published: boolean;
    }) => Promise<{ error: string } | undefined>;
    submitLabel: string;
    onDelete?: () => Promise<{ error: string } | undefined>;
}

export default function BlogForm({
    draftKey,
    initial,
    onSubmit,
    submitLabel,
    onDelete,
}: BlogFormProps) {
    // ── Restore draft from localStorage on mount ──
    const storageKey = `draft:${draftKey}`;
    const restoredDraft = useRef<{
        title: string;
        synopsis: string;
        cover_image_url: string | null;
        content: string;
        published: boolean;
    } | null>(null);

    // Read draft synchronously before first render
    if (restoredDraft.current === null) {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                restoredDraft.current = JSON.parse(raw);
            }
        } catch {
            // ignore parse errors
        }
        if (!restoredDraft.current) {
            restoredDraft.current = {} as never; // sentinel: checked, nothing found
        }
    }

    const draft =
        "title" in (restoredDraft.current ?? {}) ? restoredDraft.current : null;

    const [title, setTitle] = useState(draft?.title ?? initial?.title ?? "");
    const [synopsis, setSynopsis] = useState(
        draft?.synopsis ?? initial?.synopsis ?? "",
    );
    const [coverUrl, setCoverUrl] = useState<string | null>(
        draft?.cover_image_url ?? initial?.cover_image_url ?? null,
    );
    const [content, setContent] = useState(
        draft?.content ?? initial?.content ?? "",
    );
    const [published, setPublished] = useState(
        draft?.published ?? initial?.published ?? false,
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);

    // ── Debounced auto-save to localStorage ──
    const saveDraft = useCallback(() => {
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify({
                    title,
                    synopsis,
                    cover_image_url: coverUrl,
                    content,
                    published,
                }),
            );
            setLastAutoSave(new Date());
        } catch {
            // storage full or unavailable — silently skip
        }
    }, [storageKey, title, synopsis, coverUrl, content, published]);

    // Save after a brief pause in editing
    useEffect(() => {
        const timer = setTimeout(saveDraft, AUTO_SAVE_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [saveDraft]);

    // Also save on beforeunload
    useEffect(() => {
        const handler = () => saveDraft();
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [saveDraft]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const result = await onSubmit({
            title,
            synopsis,
            cover_image_url: coverUrl,
            content,
            published,
        });

        if (result?.error) {
            setError(result.error);
            setSaving(false);
        } else {
            // Clear draft on successful save (server action will redirect)
            try {
                localStorage.removeItem(storageKey);
            } catch {
                /* ignore */
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Title */}
            <div className="flex flex-col gap-2">
                <label
                    className="text-xs tracking-[2px] uppercase text-white/40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    Title
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="rounded border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-white/40"
                    style={{ fontFamily: "var(--font-open-sans), sans-serif" }}
                />
            </div>

            {/* Synopsis */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label
                        className="text-xs tracking-[2px] uppercase text-white/40"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        Synopsis
                    </label>
                    <span
                        className="text-xs"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            color:
                                synopsis.length > SYNOPSIS_MAX
                                    ? "#f87171"
                                    : "rgba(255,255,255,0.3)",
                        }}
                    >
                        {synopsis.length}/{SYNOPSIS_MAX}
                    </span>
                </div>
                <textarea
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    maxLength={SYNOPSIS_MAX}
                    rows={3}
                    required
                    className="resize-none rounded border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-white/40"
                    style={{ fontFamily: "var(--font-open-sans), sans-serif" }}
                />
            </div>

            {/* Cover Image */}
            <ImageUpload value={coverUrl} onChange={setCoverUrl} />

            {/* Card Preview */}
            {(title || synopsis) && (
                <div className="flex flex-col gap-2">
                    <label
                        className="text-xs tracking-[2px] uppercase text-white/40"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        Card Preview
                    </label>
                    <div
                        className="rounded-xl border border-white/10 bg-white/3 p-5"
                        style={{ maxWidth: 420 }}
                    >
                        <h3
                            className="text-base font-semibold tracking-wide text-white"
                            style={{
                                fontFamily: "var(--font-open-sans), sans-serif",
                                lineHeight: 1.3,
                            }}
                        >
                            {title || "Post Title"}
                        </h3>
                        {synopsis && (
                            <p
                                className="mt-3 text-sm leading-relaxed text-white/80"
                                style={{
                                    fontFamily:
                                        "var(--font-open-sans), sans-serif",
                                }}
                            >
                                {synopsis}
                            </p>
                        )}
                        <span
                            className="mt-3 inline-block rounded border border-white/20 px-3 py-1 text-[10px] tracking-[2px] uppercase text-white/50"
                            style={{
                                fontFamily: "var(--font-geist-mono), monospace",
                            }}
                        >
                            READ MORE
                        </span>
                    </div>
                </div>
            )}

            {/* Content Editor */}
            <div className="flex flex-col gap-2">
                <label
                    className="text-xs tracking-[2px] uppercase text-white/40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    Content
                </label>
                <TiptapEditor
                    content={content}
                    onChange={setContent}
                    lastSaved={lastAutoSave}
                />
            </div>

            {/* Published toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-white/5 accent-white"
                />
                <span
                    className="text-xs tracking-[2px] uppercase text-white/50"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    Published
                </span>
            </label>

            {/* Error */}
            {error && (
                <p
                    className="text-xs text-red-400"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    {error}
                </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded border border-white/30 px-5 py-2.5 text-xs tracking-[3px] uppercase text-white/70 transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    {saving ? "Saving..." : submitLabel}
                </button>

                {onDelete && (
                    <button
                        type="button"
                        onClick={async () => {
                            if (!confirm("Delete this post?")) return;
                            const result = await onDelete();
                            if (result?.error) setError(result.error);
                        }}
                        className="rounded border border-red-500/30 px-5 py-2.5 text-xs tracking-[3px] uppercase text-red-400/70 transition-colors hover:border-red-500/60 hover:text-red-400"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        Delete
                    </button>
                )}

                {lastAutoSave && (
                    <span
                        className="ml-auto text-[10px] tracking-[1px] text-white/20"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        Draft saved{" "}
                        {lastAutoSave.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                )}
            </div>
        </form>
    );
}
