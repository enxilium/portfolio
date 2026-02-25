import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import type { BlogPost } from "@/app/lib/supabase/types";
import EditBlogFormWrapper from "./EditBlogFormWrapper";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: post } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id)
        .single();

    if (!post) notFound();

    const blogPost = post as BlogPost;

    return (
        <div className="mx-auto max-w-3xl px-6 py-12">
            <div className="mb-8 flex items-center gap-4">
                <Link
                    href="/admin/dashboard"
                    className="text-xs tracking-[2px] uppercase text-white/30 transition-colors hover:text-white/60"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    &larr; Back
                </Link>
                <h1
                    className="text-sm tracking-[4px] uppercase"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        color: "rgba(255,255,255,0.5)",
                    }}
                >
                    Edit Blog Post
                </h1>
            </div>

            <EditBlogFormWrapper post={blogPost} />
        </div>
    );
}
