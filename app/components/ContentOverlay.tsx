"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "../lib/store";
import { createClient } from "../lib/supabase/client";
import type { BlogPost, Experience } from "../lib/supabase/types";

// ── Fade/animation timings ──
const FADE_IN_MS = 300;
const FADE_OUT_MS = 250;

// ── Holographic overlay typography (inline — completely independent of page CSS) ──
const MONO = "var(--font-geist-mono), monospace";
const SANS = "var(--font-open-sans), 'Avenir', sans-serif";

function fmtFull(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function fmtShort(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
    });
}

// ────────────────────────────────────────────────────────────────
// Blog overlay body
// ────────────────────────────────────────────────────────────────
function BlogOverlayBody({ post }: { post: BlogPost }) {
    return (
        <>
            {/* Cover banner */}
            {post.cover_image_url && (
                <div
                    className="relative w-full"
                    style={{ height: "clamp(160px, 22vh, 280px)" }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={post.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ borderRadius: "12px 12px 0 0" }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, transparent 35%, rgba(8, 8, 12, 0.85) 100%)",
                        }}
                    />
                    {/* Title overlaid on cover fade */}
                    <div className="absolute bottom-0 left-0 right-0 px-8 pb-5 sm:px-12">
                        <h1
                            className="text-xl font-semibold text-white sm:text-2xl md:text-3xl"
                            style={{
                                fontFamily: SANS,
                                lineHeight: 1.25,
                                textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                            }}
                        >
                            {post.title}
                        </h1>
                        <time
                            className="mt-1.5 block text-[10px] tracking-[2.5px] uppercase"
                            style={{
                                fontFamily: MONO,
                                color: "rgba(255,255,255,0.4)",
                            }}
                        >
                            {fmtFull(post.created_at)}
                        </time>
                    </div>
                </div>
            )}

            {/* If no cover, render header inline */}
            {!post.cover_image_url && (
                <div className="px-8 pt-10 sm:px-12">
                    <h1
                        className="text-xl font-semibold text-white sm:text-2xl md:text-3xl"
                        style={{ fontFamily: SANS, lineHeight: 1.25 }}
                    >
                        {post.title}
                    </h1>
                    <time
                        className="mt-2 block text-[10px] tracking-[2.5px] uppercase"
                        style={{
                            fontFamily: MONO,
                            color: "rgba(255,255,255,0.4)",
                        }}
                    >
                        {fmtFull(post.created_at)}
                    </time>
                </div>
            )}

            {/* Article HTML — own scoped styles via overlay-body */}
            <div
                className="overlay-body px-8 pb-12 pt-8 sm:px-12"
                dangerouslySetInnerHTML={{ __html: post.content }}
            />
        </>
    );
}

// ────────────────────────────────────────────────────────────────
// Experience overlay body
// ────────────────────────────────────────────────────────────────
function ExperienceOverlayBody({ exp }: { exp: Experience }) {
    const period = exp.is_ongoing
        ? `${fmtShort(exp.start_date)} — Present`
        : `${fmtShort(exp.start_date)} — ${fmtShort(exp.end_date!)}`;

    return (
        <>
            {/* Cover banner */}
            {exp.cover_image_url && (
                <div
                    className="relative w-full"
                    style={{ height: "clamp(160px, 22vh, 280px)" }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={exp.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ borderRadius: "12px 12px 0 0" }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, transparent 35%, rgba(8, 8, 12, 0.85) 100%)",
                        }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 px-8 pb-5 sm:px-12">
                        <div className="flex items-center gap-3">
                            {exp.logo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={exp.logo_url}
                                    alt={exp.organization}
                                    className="h-9 w-9 rounded border border-white/20 object-cover"
                                    style={{
                                        filter: "grayscale(100%) brightness(1.2)",
                                    }}
                                />
                            )}
                            <h1
                                className="text-xl font-semibold text-white sm:text-2xl md:text-3xl"
                                style={{
                                    fontFamily: SANS,
                                    lineHeight: 1.25,
                                    textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                                }}
                            >
                                {exp.position_title}
                            </h1>
                        </div>
                        <p
                            className="mt-1.5 text-[10px] tracking-[2.5px] uppercase"
                            style={{
                                fontFamily: MONO,
                                color: "rgba(255,255,255,0.4)",
                            }}
                        >
                            {exp.organization} &middot; {period}
                        </p>
                    </div>
                </div>
            )}

            {/* No cover fallback */}
            {!exp.cover_image_url && (
                <div className="px-8 pt-10 sm:px-12">
                    <div className="flex items-center gap-3">
                        {exp.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={exp.logo_url}
                                alt={exp.organization}
                                className="h-9 w-9 rounded border border-white/20 object-cover"
                                style={{ filter: "grayscale(100%)" }}
                            />
                        )}
                        <h1
                            className="text-xl font-semibold text-white sm:text-2xl md:text-3xl"
                            style={{ fontFamily: SANS, lineHeight: 1.25 }}
                        >
                            {exp.position_title}
                        </h1>
                    </div>
                    <p
                        className="mt-2 text-[10px] tracking-[2.5px] uppercase"
                        style={{
                            fontFamily: MONO,
                            color: "rgba(255,255,255,0.4)",
                        }}
                    >
                        {exp.organization} &middot; {period}
                    </p>
                </div>
            )}

            {/* Article HTML */}
            <div
                className="overlay-body px-8 pb-12 pt-8 sm:px-12"
                dangerouslySetInnerHTML={{ __html: exp.content }}
            />
        </>
    );
}

// ────────────────────────────────────────────────────────────────
// Main overlay component
// ────────────────────────────────────────────────────────────────
export default function ContentOverlay() {
    const contentOverlay = useStore((s) => s.contentOverlay);
    const setContentOverlay = useStore((s) => s.setContentOverlay);

    const [active, setActive] = useState<{
        type: "blog" | "experience";
        slug: string;
    } | null>(null);
    const [visible, setVisible] = useState(false);
    const [fadedIn, setFadedIn] = useState(false);

    const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
    const [experience, setExperience] = useState<Experience | null>(null);
    const [loading, setLoading] = useState(false);

    const fadeOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Open / close ──
    useEffect(() => {
        if (contentOverlay) {
            if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);

            setTimeout(() => {
                setActive(contentOverlay);
                setVisible(true);
                setBlogPost(null);
                setExperience(null);
                setLoading(true);
            }, 0);

            const supabase = createClient();
            if (contentOverlay.type === "blog") {
                supabase
                    .from("blog_posts")
                    .select("*")
                    .eq("slug", contentOverlay.slug)
                    .eq("published", true)
                    .single()
                    .then(({ data }) => {
                        if (data) setBlogPost(data as BlogPost);
                        setLoading(false);
                    });
            } else {
                supabase
                    .from("experiences")
                    .select("*")
                    .eq("slug", contentOverlay.slug)
                    .eq("published", true)
                    .single()
                    .then(({ data }) => {
                        if (data) setExperience(data as Experience);
                        setLoading(false);
                    });
            }

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setFadedIn(true);
                });
            });
        } else {
            setTimeout(() => {
                setFadedIn(false);
            }, 0);
            fadeOutTimer.current = setTimeout(() => {
                setVisible(false);
                setActive(null);
                setBlogPost(null);
                setExperience(null);
            }, FADE_OUT_MS + 50);
        }

        return () => {
            if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
        };
    }, [contentOverlay]);

    const close = useCallback(() => {
        setContentOverlay(null);
    }, [setContentOverlay]);

    useEffect(() => {
        if (!visible) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [visible, close]);

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) close();
        },
        [close],
    );

    if (!visible || !active) return null;

    const isBlog = active.type === "blog";
    const post = isBlog ? blogPost : null;
    const exp = !isBlog ? experience : null;
    const hasData = !!(post || exp);

    return (
        <div
            className="pointer-events-none fixed inset-0 z-40"
            style={{
                opacity: fadedIn ? 1 : 0,
                transition: `opacity ${fadedIn ? FADE_IN_MS : FADE_OUT_MS}ms ease-in-out`,
            }}
        >
            {/* Transparent backdrop — click outside to close */}
            <div
                className="pointer-events-auto absolute inset-0"
                onClick={handleBackdropClick}
            />

            {/* Panel */}
            <div
                ref={scrollRef}
                className="pointer-events-auto holographic-overlay"
                style={{
                    position: "absolute",
                    top: "3.5rem",
                    right: "3.5rem",
                    bottom: "3.5rem",
                    left: "3.5rem",
                    overflowY: "auto",
                    background: "rgba(8, 8, 12, 0.72)",
                    borderRadius: "12px",
                    transform: fadedIn ? "scale(1)" : "scale(0.97)",
                    transition: `transform ${fadedIn ? FADE_IN_MS : FADE_OUT_MS}ms ease-out`,
                    boxShadow:
                        "0 0 60px rgba(100, 180, 255, 0.06), 0 0 120px rgba(100, 180, 255, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                }}
            >
                {/* Scan-lines */}
                <div
                    className="holographic-scanlines pointer-events-none absolute inset-0"
                    style={{ borderRadius: "12px" }}
                />

                {/* Back button — floats over cover image */}
                <div className="sticky top-0 z-10" style={{ height: 0 }}>
                    <button
                        type="button"
                        onClick={close}
                        className="ml-5 mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs tracking-[2px] uppercase transition-colors"
                        style={{
                            fontFamily: MONO,
                            color: "rgba(255, 255, 255, 0.85)",
                            background: "rgba(0, 0, 0, 0.35)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            textShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.background =
                                "rgba(0,0,0,0.5)";
                            e.currentTarget.style.borderColor =
                                "rgba(255,255,255,0.3)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color =
                                "rgba(255,255,255,0.85)";
                            e.currentTarget.style.background =
                                "rgba(0,0,0,0.35)";
                            e.currentTarget.style.borderColor =
                                "rgba(255,255,255,0.15)";
                        }}
                    >
                        &larr; Back
                    </button>
                </div>

                {/* Loading */}
                {loading && (
                    <div
                        className="flex items-center justify-center py-32"
                        style={{
                            fontFamily: MONO,
                            color: "rgba(255,255,255,0.3)",
                            fontSize: "0.75rem",
                            letterSpacing: "3px",
                        }}
                    >
                        LOADING...
                    </div>
                )}

                {/* Content */}
                {!loading &&
                    hasData &&
                    (isBlog && post ? (
                        <BlogOverlayBody post={post} />
                    ) : (
                        exp && <ExperienceOverlayBody exp={exp} />
                    ))}

                {/* Not found */}
                {!loading && !hasData && (
                    <div
                        className="flex items-center justify-center py-32"
                        style={{
                            fontFamily: MONO,
                            color: "rgba(255,255,255,0.3)",
                            fontSize: "0.75rem",
                            letterSpacing: "3px",
                        }}
                    >
                        CONTENT NOT FOUND
                    </div>
                )}
            </div>
        </div>
    );
}
