"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TiptapEditor from "./TiptapEditor";
import ImageUpload from "./ImageUpload";

// Max synopsis length enforced in UI and DB
const SYNOPSIS_MAX = 160;

// Auto-save debounce delay in milliseconds (2 seconds after last change)
const AUTO_SAVE_DEBOUNCE = 2_000;

interface ExperienceFormProps {
    /** Unique key for localStorage draft (e.g. "exp-new" or "exp-{id}") */
    draftKey: string;
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
    draftKey,
    initial,
    onSubmit,
    submitLabel,
    onDelete,
}: ExperienceFormProps) {
    // ── Restore draft from localStorage on mount ──
    const storageKey = `draft:${draftKey}`;
    const restoredDraft = useRef<{
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
    } | null>(null);

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
            restoredDraft.current = {} as never;
        }
    }

    const draft =
        "position_title" in (restoredDraft.current ?? {})
            ? restoredDraft.current
            : null;

    const [positionTitle, setPositionTitle] = useState(
        draft?.position_title ?? initial?.position_title ?? "",
    );
    const [organization, setOrganization] = useState(
        draft?.organization ?? initial?.organization ?? "",
    );
    const [startDate, setStartDate] = useState(
        draft?.start_date ?? initial?.start_date ?? "",
    );
    const [endDate, setEndDate] = useState(
        draft?.end_date ?? initial?.end_date ?? "",
    );
    const [isOngoing, setIsOngoing] = useState(
        draft?.is_ongoing ?? initial?.is_ongoing ?? false,
    );
    const [synopsis, setSynopsis] = useState(
        draft?.synopsis ?? initial?.synopsis ?? "",
    );
    const [logoUrl, setLogoUrl] = useState<string | null>(
        draft?.logo_url ?? initial?.logo_url ?? null,
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
                }),
            );
            setLastAutoSave(new Date());
        } catch {
            // storage full or unavailable
        }
    }, [
        storageKey,
        positionTitle,
        organization,
        startDate,
        endDate,
        isOngoing,
        synopsis,
        logoUrl,
        coverUrl,
        content,
        published,
    ]);

    // Save after a brief pause in editing
    useEffect(() => {
        const timer = setTimeout(saveDraft, AUTO_SAVE_DEBOUNCE);
        return () => clearTimeout(timer);
    }, [saveDraft]);

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
        } else {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                /* ignore */
            }
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
                previewMode="contain"
            />

            {/* Cover Image */}
            <ImageUpload value={coverUrl} onChange={setCoverUrl} />

            {/* Card Preview */}
            {(positionTitle || organization || synopsis) && (
                <div className="flex flex-col gap-2">
                    <label
                        className={labelClass}
                        style={{ fontFamily: monoFont }}
                    >
                        Card Preview
                    </label>
                    <div
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                        style={{ maxWidth: 420 }}
                    >
                        <div className="flex items-center gap-3">
                            {logoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={logoUrl}
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded-md object-cover"
                                    style={{ filter: "grayscale(100%)" }}
                                />
                            )}
                            <h3
                                className="text-base font-semibold tracking-wide text-white"
                                style={{
                                    fontFamily: sansFont,
                                    lineHeight: 1.3,
                                }}
                            >
                                {positionTitle || "Position Title"}
                            </h3>
                        </div>
                        <p
                            className="mt-2 text-[10px] tracking-[2px] uppercase text-white/40"
                            style={{ fontFamily: monoFont }}
                        >
                            {organization || "Organization"}
                            {startDate && (
                                <>
                                    {" / "}
                                    {new Date(startDate).toLocaleDateString(
                                        "en-US",
                                        { year: "numeric", month: "short" },
                                    )}
                                    {" — "}
                                    {isOngoing
                                        ? "Present"
                                        : endDate
                                          ? new Date(
                                                endDate,
                                            ).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                            })
                                          : "…"}
                                </>
                            )}
                        </p>
                        {synopsis && (
                            <p
                                className="mt-3 text-sm leading-relaxed text-white/80"
                                style={{ fontFamily: sansFont }}
                            >
                                {synopsis}
                            </p>
                        )}
                        <span
                            className="mt-3 inline-block rounded border border-white/20 px-3 py-1 text-[10px] tracking-[2px] uppercase text-white/50"
                            style={{ fontFamily: monoFont }}
                        >
                            READ MORE
                        </span>
                    </div>
                </div>
            )}

            {/* Content Editor */}
            <div className="flex flex-col gap-2">
                <label className={labelClass} style={{ fontFamily: monoFont }}>
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

                {lastAutoSave && (
                    <span
                        className="ml-auto text-[10px] tracking-[1px] text-white/20"
                        style={{ fontFamily: monoFont }}
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
