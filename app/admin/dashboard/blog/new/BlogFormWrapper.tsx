"use client";

import BlogForm from "@/app/admin/components/BlogForm";
import { createBlogPost } from "@/app/admin/actions/blog";

export default function BlogFormWrapper() {
    return (
        <BlogForm
            draftKey="blog-new"
            submitLabel="Create Post"
            onSubmit={async (data) => {
                const result = await createBlogPost(data);
                return result;
            }}
        />
    );
}
