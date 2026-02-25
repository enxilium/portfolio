import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import type { BlogPost, Experience } from "@/app/lib/supabase/types";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
    const supabase = await createClient();

    // Fetch all posts (admin sees drafts too) — RLS allows authenticated full access
    const { data: blogPosts } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });

    const { data: experiences } = await supabase
        .from("experiences")
        .select("*")
        .order("end_date", { ascending: false, nullsFirst: true });

    return (
        <div className="mx-auto max-w-4xl px-6 py-12">
            {/* Header */}
            <div className="mb-12 flex items-center justify-between">
                <h1
                    className="text-lg tracking-[6px] uppercase"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        color: "rgba(255,255,255,0.5)",
                    }}
                >
                    {"// DASHBOARD"}
                </h1>
                <DashboardClient />
            </div>

            {/* Blog Posts Section */}
            <section className="mb-16">
                <div className="mb-6 flex items-center justify-between">
                    <h2
                        className="text-sm tracking-[4px] uppercase"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            color: "rgba(255,255,255,0.4)",
                        }}
                    >
                        Blog Posts
                    </h2>
                    <Link
                        href="/admin/dashboard/blog/new"
                        className="rounded border border-white/20 px-3 py-1.5 text-xs tracking-[2px] uppercase text-white/60 transition-colors hover:border-white/50 hover:text-white"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        + New Post
                    </Link>
                </div>

                {(!blogPosts || blogPosts.length === 0) && (
                    <p
                        className="text-sm text-white/30"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        No blog posts yet.
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    {(blogPosts as BlogPost[] | null)?.map((post) => (
                        <Link
                            key={post.id}
                            href={`/admin/dashboard/blog/${post.id}/edit`}
                            className="group flex items-center justify-between rounded border border-white/10 px-4 py-3 transition-colors hover:border-white/25"
                        >
                            <div className="flex flex-col gap-1">
                                <span
                                    className="text-sm text-white/80 group-hover:text-white"
                                    style={{
                                        fontFamily:
                                            "var(--font-open-sans), sans-serif",
                                    }}
                                >
                                    {post.title}
                                </span>
                                <span
                                    className="text-xs text-white/30"
                                    style={{
                                        fontFamily:
                                            "var(--font-geist-mono), monospace",
                                    }}
                                >
                                    /{post.slug}
                                </span>
                            </div>
                            <span
                                className="text-xs"
                                style={{
                                    fontFamily:
                                        "var(--font-geist-mono), monospace",
                                    color: post.published
                                        ? "rgba(100,220,100,0.7)"
                                        : "rgba(255,255,255,0.25)",
                                }}
                            >
                                {post.published ? "LIVE" : "DRAFT"}
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Experiences Section */}
            <section>
                <div className="mb-6 flex items-center justify-between">
                    <h2
                        className="text-sm tracking-[4px] uppercase"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                            color: "rgba(255,255,255,0.4)",
                        }}
                    >
                        Experiences
                    </h2>
                    <Link
                        href="/admin/dashboard/experience/new"
                        className="rounded border border-white/20 px-3 py-1.5 text-xs tracking-[2px] uppercase text-white/60 transition-colors hover:border-white/50 hover:text-white"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        + New Experience
                    </Link>
                </div>

                {(!experiences || experiences.length === 0) && (
                    <p
                        className="text-sm text-white/30"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        No experiences yet.
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    {(experiences as Experience[] | null)?.map((exp) => (
                        <Link
                            key={exp.id}
                            href={`/admin/dashboard/experience/${exp.id}/edit`}
                            className="group flex items-center justify-between rounded border border-white/10 px-4 py-3 transition-colors hover:border-white/25"
                        >
                            <div className="flex flex-col gap-1">
                                <span
                                    className="text-sm text-white/80 group-hover:text-white"
                                    style={{
                                        fontFamily:
                                            "var(--font-open-sans), sans-serif",
                                    }}
                                >
                                    {exp.position_title}
                                </span>
                                <span
                                    className="text-xs text-white/30"
                                    style={{
                                        fontFamily:
                                            "var(--font-geist-mono), monospace",
                                    }}
                                >
                                    {exp.organization} ·{" "}
                                    {exp.is_ongoing ? "Present" : exp.end_date}
                                </span>
                            </div>
                            <span
                                className="text-xs"
                                style={{
                                    fontFamily:
                                        "var(--font-geist-mono), monospace",
                                    color: exp.published
                                        ? "rgba(100,220,100,0.7)"
                                        : "rgba(255,255,255,0.25)",
                                }}
                            >
                                {exp.published ? "LIVE" : "DRAFT"}
                            </span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
