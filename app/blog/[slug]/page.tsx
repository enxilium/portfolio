import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import type { BlogPost } from "@/app/lib/supabase/types";
import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: post } = await supabase
        .from("blog_posts")
        .select("title, synopsis")
        .eq("slug", slug)
        .eq("published", true)
        .single();

    if (!post) return { title: "Not Found" };

    return {
        title: post.title,
        description: post.synopsis,
    };
}

export default async function BlogPostPage({ params }: PageProps) {
    const { slug } = await params;
    const supabase = await createClient();

    const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single();

    if (!data) notFound();

    const post = data as BlogPost;

    const formattedDate = new Date(post.created_at).toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "long",
            day: "numeric",
        },
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Cover image */}
            {post.cover_image_url && (
                <div className="relative h-64 w-full sm:h-80 md:h-96">
                    <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0a]" />
                </div>
            )}

            <article className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
                {/* Back link */}
                <Link
                    href="/"
                    className="mb-8 inline-block text-xs tracking-[2px] uppercase text-white/30 transition-colors hover:text-white/60"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    &larr; Home
                </Link>

                {/* Header */}
                <header className="mb-10">
                    <h1
                        className="text-2xl font-semibold tracking-wide text-white sm:text-3xl"
                        style={{
                            fontFamily:
                                "var(--font-open-sans), 'Avenir', sans-serif",
                            lineHeight: 1.3,
                        }}
                    >
                        {post.title}
                    </h1>
                    <time
                        className="mt-3 block text-xs tracking-[2px] uppercase text-white/35"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        {formattedDate}
                    </time>
                </header>

                {/* Content */}
                <div
                    className="content-body"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                />
            </article>
        </div>
    );
}
