"use server";

import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import type { BlogPostInput } from "@/app/lib/supabase/types";

// Generate a URL-safe slug from text
function toSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function createBlogPost(input: BlogPostInput) {
    const supabase = await createClient();

    const { error } = await supabase.from("blog_posts").insert({
        title: input.title,
        slug: toSlug(input.title),
        synopsis: input.synopsis.slice(0, 160),
        cover_image_url: input.cover_image_url,
        content: input.content,
        published: input.published,
    });

    if (error) {
        return { error: error.message };
    }

    redirect("/admin/dashboard");
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("blog_posts")
        .update({
            title: input.title,
            slug: toSlug(input.title),
            synopsis: input.synopsis.slice(0, 160),
            cover_image_url: input.cover_image_url,
            content: input.content,
            published: input.published,
        })
        .eq("id", id);

    if (error) {
        return { error: error.message };
    }

    redirect("/admin/dashboard");
}

export async function deleteBlogPost(id: string) {
    const supabase = await createClient();

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);

    if (error) {
        return { error: error.message };
    }

    redirect("/admin/dashboard");
}
