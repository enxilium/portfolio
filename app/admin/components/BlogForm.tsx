"use client";

import { useState } from "react";
import TiptapEditor from "./TiptapEditor";
import ImageUpload from "./ImageUpload";

// Max synopsis length enforced in UI and DB
const SYNOPSIS_MAX = 160;

interface BlogFormProps {
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
    initial,
    onSubmit,
    submitLabel,
    onDelete,
}: BlogFormProps) {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [synopsis, setSynopsis] = useState(initial?.synopsis ?? "");
    const [coverUrl, setCoverUrl] = useState<string | null>(
        initial?.cover_image_url ?? null,
    );
    const [content, setContent] = useState(initial?.content ?? "");
    const [published, setPublished] = useState(initial?.published ?? false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

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
        }
        // On success, the server action redirects
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

            {/* Content Editor */}
            <div className="flex flex-col gap-2">
                <label
                    className="text-xs tracking-[2px] uppercase text-white/40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    Content
                </label>
                <TiptapEditor content={content} onChange={setContent} />
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
            </div>
        </form>
    );
}
