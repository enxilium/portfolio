"use client";

import BlogForm from "@/app/admin/components/BlogForm";
import { updateBlogPost, deleteBlogPost } from "@/app/admin/actions/blog";
import type { BlogPost } from "@/app/lib/supabase/types";

interface EditBlogFormWrapperProps {
    post: BlogPost;
}

export default function EditBlogFormWrapper({
    post,
}: EditBlogFormWrapperProps) {
    return (
        <BlogForm
            draftKey={`blog-${post.id}`}
            initial={{
                title: post.title,
                synopsis: post.synopsis,
                cover_image_url: post.cover_image_url,
                content: post.content,
                published: post.published,
            }}
            submitLabel="Save Changes"
            onSubmit={async (data) => {
                const result = await updateBlogPost(post.id, data);
                return result;
            }}
            onDelete={async () => {
                const result = await deleteBlogPost(post.id);
                return result;
            }}
        />
    );
}
