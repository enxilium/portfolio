"use client";

import { useState } from "react";
import TiptapEditor from "./TiptapEditor";
import ImageUpload from "./ImageUpload";

// Max synopsis length enforced in UI and DB
const SYNOPSIS_MAX = 160;

interface ExperienceFormProps {
    initial?: {
        position_title: string;
        organization: string;
        start_date: string;
        end_date: string | null;
        is_ongoing: boolean;
        synopsis: string;
        logo_url: string | null;
        cover_image_url: string | null;
        content: string;
        published: boolean;
    };
    onSubmit: (data: {
        position_title: string;
        organization: string;
        start_date: string;
        end_date: string | null;
        is_ongoing: boolean;
        synopsis: string;
        logo_url: string | null;
        cover_image_url: string | null;
        content: string;
        published: boolean;
    }) => Promise<{ error: string } | undefined>;
    submitLabel: string;
    onDelete?: () => Promise<{ error: string } | undefined>;
}

export default function ExperienceForm({
    initial,
    onSubmit,
    submitLabel,
    onDelete,
}: ExperienceFormProps) {
    const [positionTitle, setPositionTitle] = useState(
        initial?.position_title ?? "",
    );
    const [organization, setOrganization] = useState(
        initial?.organization ?? "",
    );
    const [startDate, setStartDate] = useState(initial?.start_date ?? "");
    const [endDate, setEndDate] = useState(initial?.end_date ?? "");
    const [isOngoing, setIsOngoing] = useState(initial?.is_ongoing ?? false);
    const [synopsis, setSynopsis] = useState(initial?.synopsis ?? "");
    const [logoUrl, setLogoUrl] = useState<string | null>(
        initial?.logo_url ?? null,
    );
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
            position_title: positionTitle,
            organization,
            start_date: startDate,
            end_date: isOngoing ? null : endDate || null,
            is_ongoing: isOngoing,
            synopsis,
            logo_url: logoUrl,
            cover_image_url: coverUrl,
            content,
            published,
        });

        if (result?.error) {
            setError(result.error);
            setSaving(false);
        }
    };

    const monoFont = "var(--font-geist-mono), monospace";
    const sansFont = "var(--font-open-sans), sans-serif";
    const labelClass = "text-xs tracking-[2px] uppercase text-white/40";
    const inputClass =
        "rounded border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-white/40";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Position Title */}
            <div className="flex flex-col gap-2">
                <label className={labelClass} style={{ fontFamily: monoFont }}>
                    Position Title
                </label>
                <input
                    type="text"
                    value={positionTitle}
                    onChange={(e) => setPositionTitle(e.target.value)}
                    required
                    className={inputClass}
                    style={{ fontFamily: sansFont }}
                />
            </div>

            {/* Organization */}
            <div className="flex flex-col gap-2">
                <label className={labelClass} style={{ fontFamily: monoFont }}>
                    Organization
                </label>
                <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    required
                    className={inputClass}
                    style={{ fontFamily: sansFont }}
                />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label
                        className={labelClass}
                        style={{ fontFamily: monoFont }}
                    >
                        Start Date
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className={inputClass}
                        style={{ fontFamily: monoFont }}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label
                        className={labelClass}
                        style={{ fontFamily: monoFont }}
                    >
                        End Date
                    </label>
                    {isOngoing ? (
                        <div
                            className="flex items-center rounded border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/30"
                            style={{ fontFamily: monoFont }}
                        >
                            Present
                        </div>
                    ) : (
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={inputClass}
                            style={{ fontFamily: monoFont }}
                        />
                    )}
                </div>
            </div>

            {/* Ongoing checkbox */}
            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isOngoing}
                    onChange={(e) => setIsOngoing(e.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-white/5 accent-white"
                />
                <span
                    className="text-xs tracking-[2px] uppercase text-white/50"
                    style={{ fontFamily: monoFont }}
                >
                    Ongoing Position
                </span>
            </label>

            {/* Synopsis */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label
                        className={labelClass}
                        style={{ fontFamily: monoFont }}
                    >
                        Synopsis
                    </label>
                    <span
                        className="text-xs"
                        style={{
                            fontFamily: monoFont,
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
                    className={`resize-none ${inputClass}`}
                    style={{ fontFamily: sansFont }}
                />
            </div>

            {/* Organization Logo */}
            <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                label="Organization Logo"
                aspectRatio={1}
                outputWidth={256}
                grayscale
                storagePath="logos"
                previewHeight="h-20"
            />

            {/* Cover Image */}
            <ImageUpload value={coverUrl} onChange={setCoverUrl} />

            {/* Content Editor */}
            <div className="flex flex-col gap-2">
                <label className={labelClass} style={{ fontFamily: monoFont }}>
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
                    style={{ fontFamily: monoFont }}
                >
                    Published
                </span>
            </label>

            {/* Error */}
            {error && (
                <p
                    className="text-xs text-red-400"
                    style={{ fontFamily: monoFont }}
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
                    style={{ fontFamily: monoFont }}
                >
                    {saving ? "Saving..." : submitLabel}
                </button>

                {onDelete && (
                    <button
                        type="button"
                        onClick={async () => {
                            if (!confirm("Delete this experience?")) return;
                            const result = await onDelete();
                            if (result?.error) setError(result.error);
                        }}
                        className="rounded border border-red-500/30 px-5 py-2.5 text-xs tracking-[3px] uppercase text-red-400/70 transition-colors hover:border-red-500/60 hover:text-red-400"
                        style={{ fontFamily: monoFont }}
                    >
                        Delete
                    </button>
                )}
            </div>
        </form>
    );
}
