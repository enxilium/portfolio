"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "../lib/store";
import { createClient } from "../lib/supabase/client";
import type { BlogPost, Experience } from "../lib/supabase/types";

// ── Slide shape used by the carousel ──
interface BlogSlide {
    title: string;
    date: string;
    body: string;
    href: string;
}

interface ExperienceSlide {
    title: string;
    company: string;
    period: string;
    body: string;
    href: string;
    logoUrl: string | null;
}

// ── Fallback data shown when Supabase is not configured or returns nothing ──
const FALLBACK_BLOG_SLIDES: BlogSlide[] = [
    {
        title: "No posts yet",
        date: "",
        body: "Blog posts will appear here once published via the admin panel.",
        href: "#",
    },
];

const FALLBACK_EXPERIENCE_SLIDES: ExperienceSlide[] = [
    {
        title: "No experiences yet",
        company: "",
        period: "",
        body: "Experiences will appear here once published via the admin panel.",
        href: "#",
        logoUrl: null,
    },
];

// Format a date string to "MMM YYYY"
function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
    });
}

// ── Transition timing ──
// Delay before content fades in after camera begins moving to pillar
const FADE_IN_DELAY_MS = 600;
// Duration of the fade-in/out CSS transition
const FADE_DURATION_MS = 500;
// Duration of slide cross-fade
const SLIDE_FADE_MS = 300;

export default function PillarContent() {
    const focusedPillar = useStore((s) => s.focusedPillar);

    // ── Supabase data ──
    const [blogSlides, setBlogSlides] =
        useState<BlogSlide[]>(FALLBACK_BLOG_SLIDES);
    const [expSlides, setExpSlides] = useState<ExperienceSlide[]>(
        FALLBACK_EXPERIENCE_SLIDES,
    );
    const fetchedRef = useRef(false);

    // Fetch published content once on mount
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const supabase = createClient();

        // Fetch blog posts
        supabase
            .from("blog_posts")
            .select("title, slug, synopsis, created_at")
            .eq("published", true)
            .order("created_at", { ascending: false })
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setBlogSlides(
                        (
                            data as Pick<
                                BlogPost,
                                "title" | "slug" | "synopsis" | "created_at"
                            >[]
                        ).map((p) => ({
                            title: p.title,
                            date: fmtDate(p.created_at),
                            body: p.synopsis,
                            href: `/blog/${p.slug}`,
                        })),
                    );
                }
            });

        // Fetch experiences
        supabase
            .from("experiences")
            .select(
                "slug, position_title, organization, start_date, end_date, is_ongoing, synopsis, logo_url",
            )
            .eq("published", true)
            .order("end_date", { ascending: false, nullsFirst: true })
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setExpSlides(
                        (
                            data as Pick<
                                Experience,
                                | "slug"
                                | "position_title"
                                | "organization"
                                | "start_date"
                                | "end_date"
                                | "is_ongoing"
                                | "synopsis"
                                | "logo_url"
                            >[]
                        ).map((e) => ({
                            title: e.position_title,
                            company: e.organization,
                            period: e.is_ongoing
                                ? `${fmtDate(e.start_date)} — Present`
                                : `${fmtDate(e.start_date)} — ${fmtDate(e.end_date!)}`,
                            body: e.synopsis,
                            href: `/experience/${e.slug}`,
                            logoUrl: e.logo_url,
                        })),
                    );
                }
            });
    }, []);

    // Track which pillar we're rendering (persists through fade-out)
    const [activePillar, setActivePillar] = useState<"left" | "right" | null>(
        null,
    );
    // "fadedIn" controls the CSS opacity.  It starts false and gets set
    // to true after a delay once a pillar is focused.
    const [fadedIn, setFadedIn] = useState(false);
    const [slideIndex, setSlideIndex] = useState(0);
    const [slideFade, setSlideFade] = useState(1); // 0 = transparent, 1 = opaque
    const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimers = useCallback(() => {
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        if (slideTimer.current) clearTimeout(slideTimer.current);
    }, []);

    // When a pillar becomes focused, schedule a delayed fade-in.
    // When it un-focuses, start a fade-out and then clean up.
    // All setState calls happen inside async callbacks (setTimeout), which
    // React 19 does not flag as synchronous-in-effect.
    useEffect(() => {
        clearTimers();

        if (focusedPillar) {
            // Immediately set activePillar so the DOM mounts (opacity 0)
            fadeTimer.current = setTimeout(() => {
                setActivePillar(focusedPillar);
                setSlideIndex(0);
                setSlideFade(1);
            }, 0);

            // After the camera has had time to move, fade in
            const fadeInTimer = setTimeout(() => {
                setFadedIn(true);
            }, FADE_IN_DELAY_MS);

            return () => {
                clearTimers();
                clearTimeout(fadeInTimer);
            };
        } else {
            // Trigger CSS fade-out
            fadeTimer.current = setTimeout(() => {
                setFadedIn(false);
            }, 0);

            // After the fade-out transition completes, unmount the content
            const cleanupTimer = setTimeout(() => {
                setActivePillar(null);
                setSlideIndex(0);
            }, FADE_DURATION_MS + 50);

            return () => {
                clearTimers();
                clearTimeout(cleanupTimer);
            };
        }
    }, [focusedPillar, clearTimers]);

    // Slide navigation with cross-fade
    const goToSlide = useCallback((next: number) => {
        if (slideTimer.current) clearTimeout(slideTimer.current);
        setSlideFade(0);
        slideTimer.current = setTimeout(() => {
            setSlideIndex(next);
            setSlideFade(1);
        }, SLIDE_FADE_MS);
    }, []);

    if (!activePillar) return null;

    const isLeft = activePillar === "left";
    const slides = isLeft ? blogSlides : expSlides;
    const sectionLabel = isLeft ? "BLOG" : "EXPERIENCE";
    const slide = slides[slideIndex];
    const totalSlides = slides.length;

    // Colors — always light text since pillar background is always dark
    const textColor = "#ffffff";
    const mutedColor = "rgba(255,255,255,0.5)";
    const accentColor = "rgba(255,255,255,0.15)";
    const dotActive = "rgba(255,255,255,0.9)";
    const dotInactive = "rgba(255,255,255,0.25)";

    return (
        <div
            className="pointer-events-none fixed inset-0 z-20 flex items-center"
            style={{
                justifyContent: isLeft ? "flex-start" : "flex-end",
                opacity: fadedIn ? 1 : 0,
                transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
            }}
        >
            <div
                className="pointer-events-auto flex flex-col"
                style={{
                    width: "min(480px, 42vw)",
                    height: "min(520px, 60vh)",
                    padding: "clamp(24px, 4vw, 48px)",
                    marginLeft: isLeft ? "clamp(32px, 6vw, 80px)" : undefined,
                    marginRight: isLeft ? undefined : "clamp(32px, 6vw, 80px)",
                    textAlign: isLeft ? "left" : "right",
                }}
            >
                {/* Section label */}
                <span
                    className="select-none"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "clamp(0.6rem, 1vw, 0.75rem)",
                        letterSpacing: "clamp(3px, 0.8vw, 6px)",
                        color: mutedColor,
                        marginBottom: "clamp(12px, 2vw, 24px)",
                        transition: "color 600ms ease-in-out",
                    }}
                >
                    {"// "}
                    {sectionLabel}
                </span>

                {/* Divider line */}
                <div
                    style={{
                        width: "100%",
                        height: "1px",
                        background: accentColor,
                        marginBottom: "clamp(16px, 2.5vw, 32px)",
                        transition: "background 600ms ease-in-out",
                    }}
                />

                {/* Slide content with cross-fade */}
                <div
                    style={{
                        opacity: slideFade,
                        transition: `opacity ${SLIDE_FADE_MS}ms ease-in-out`,
                        flex: 1,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Title */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "clamp(8px, 1vw, 14px)",
                            flexDirection: isLeft ? "row" : "row-reverse",
                        }}
                    >
                        {"logoUrl" in slide && slide.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={slide.logoUrl}
                                alt=""
                                style={{
                                    width: "clamp(28px, 3vw, 40px)",
                                    height: "clamp(28px, 3vw, 40px)",
                                    borderRadius: "6px",
                                    objectFit: "cover",
                                    filter: "grayscale(100%)",
                                    flexShrink: 0,
                                    border: "1px solid rgba(255,255,255,0.1)",
                                }}
                            />
                        )}
                        <h2
                            className="select-none"
                            style={{
                                fontFamily:
                                    "var(--font-open-sans), 'Avenir', sans-serif",
                                fontSize: "clamp(1rem, 2.2vw, 1.5rem)",
                                fontWeight: 600,
                                letterSpacing: "clamp(1px, 0.3vw, 3px)",
                                color: textColor,
                                margin: 0,
                                lineHeight: 1.3,
                                transition: "color 600ms ease-in-out",
                            }}
                        >
                            {slide.title}
                        </h2>
                    </div>

                    {/* Subtitle (date/company) */}
                    <p
                        className="select-none"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            fontSize: "clamp(0.55rem, 0.9vw, 0.7rem)",
                            letterSpacing: "clamp(1px, 0.3vw, 3px)",
                            color: mutedColor,
                            margin: 0,
                            marginTop: "clamp(6px, 1vw, 12px)",
                            transition: "color 600ms ease-in-out",
                        }}
                    >
                        {"company" in slide
                            ? `${slide.company} / ${slide.period}`
                            : slide.date}
                    </p>

                    {/* Body text */}
                    <p
                        style={{
                            fontFamily:
                                "var(--font-open-sans), 'Avenir', sans-serif",
                            fontSize: "clamp(0.75rem, 1.2vw, 0.95rem)",
                            lineHeight: 1.7,
                            color: textColor,
                            margin: 0,
                            marginTop: "clamp(12px, 2vw, 24px)",
                            opacity: 0.85,
                            transition: "color 600ms ease-in-out",
                        }}
                    >
                        {slide.body}
                    </p>
                </div>

                {/* Read more button — fixed position between text and nav */}
                <a
                    href={slide.href}
                    style={{
                        alignSelf: isLeft ? "flex-start" : "flex-end",
                        display: slide.href === "#" ? "none" : "inline-block",
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.3)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        padding: "6px 16px",
                        marginTop: "clamp(12px, 1.5vw, 20px)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "clamp(0.6rem, 0.9vw, 0.75rem)",
                        letterSpacing: "2px",
                        color: "rgba(255,255,255,0.7)",
                        textDecoration: "none",
                        transition: "color 200ms, border-color 200ms",
                        opacity: slideFade,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.borderColor =
                            "rgba(255,255,255,0.6)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                        e.currentTarget.style.borderColor =
                            "rgba(255,255,255,0.3)";
                    }}
                >
                    READ MORE
                </a>

                {/* ── Navigation: dots + arrows ── */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: isLeft ? "flex-start" : "flex-end",
                        gap: "clamp(8px, 1.2vw, 16px)",
                        marginTop: "clamp(20px, 3vw, 40px)",
                    }}
                >
                    {/* Prev arrow */}
                    <button
                        aria-label="Previous slide"
                        disabled={slideIndex === 0}
                        onClick={() => goToSlide(slideIndex - 1)}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: slideIndex === 0 ? "default" : "pointer",
                            padding: "4px 8px",
                            color: mutedColor,
                            fontSize: "clamp(0.9rem, 1.4vw, 1.2rem)",
                            fontFamily: "var(--font-geist-mono), monospace",
                            transition: "color 200ms, opacity 200ms",
                            opacity: slideIndex === 0 ? 0.2 : 0.7,
                            pointerEvents: slideIndex === 0 ? "none" : "auto",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                        }}
                    >
                        &larr;
                    </button>

                    {/* Dots */}
                    <div
                        style={{
                            display: "flex",
                            gap: "clamp(4px, 0.6vw, 8px)",
                            alignItems: "center",
                        }}
                    >
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                aria-label={`Go to slide ${i + 1}`}
                                onClick={() => {
                                    if (i !== slideIndex) goToSlide(i);
                                }}
                                style={{
                                    width: i === slideIndex ? "18px" : "6px",
                                    height: "6px",
                                    borderRadius: "3px",
                                    background:
                                        i === slideIndex
                                            ? dotActive
                                            : dotInactive,
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    transition:
                                        "width 300ms ease, background 300ms ease",
                                }}
                            />
                        ))}
                    </div>

                    {/* Next arrow */}
                    <button
                        aria-label="Next slide"
                        disabled={slideIndex === totalSlides - 1}
                        onClick={() => goToSlide(slideIndex + 1)}
                        style={{
                            background: "none",
                            border: "none",
                            cursor:
                                slideIndex === totalSlides - 1
                                    ? "default"
                                    : "pointer",
                            padding: "4px 8px",
                            color: mutedColor,
                            fontSize: "clamp(0.9rem, 1.4vw, 1.2rem)",
                            fontFamily: "var(--font-geist-mono), monospace",
                            transition: "color 200ms, opacity 200ms",
                            opacity: slideIndex === totalSlides - 1 ? 0.2 : 0.7,
                            pointerEvents:
                                slideIndex === totalSlides - 1
                                    ? "none"
                                    : "auto",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "0.7";
                        }}
                    >
                        &rarr;
                    </button>
                </div>

                {/* Slide counter */}
                <span
                    className="select-none"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "clamp(0.5rem, 0.8vw, 0.65rem)",
                        letterSpacing: "2px",
                        color: mutedColor,
                        marginTop: "clamp(8px, 1vw, 12px)",
                        textAlign: isLeft ? "left" : "right",
                        transition: "color 600ms ease-in-out",
                    }}
                >
                    {String(slideIndex + 1).padStart(2, "0")} /{" "}
                    {String(totalSlides).padStart(2, "0")}
                </span>
            </div>
        </div>
    );
}
