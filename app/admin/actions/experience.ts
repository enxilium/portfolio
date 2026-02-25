"use server";

import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ExperienceInput } from "@/app/lib/supabase/types";

// Generate a URL-safe slug from text
function toSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function createExperience(input: ExperienceInput) {
    const supabase = await createClient();

    const { error } = await supabase.from("experiences").insert({
        slug: toSlug(`${input.organization}-${input.position_title}`),
        position_title: input.position_title,
        organization: input.organization,
        start_date: input.start_date,
        end_date: input.is_ongoing ? null : input.end_date,
        is_ongoing: input.is_ongoing,
        synopsis: input.synopsis.slice(0, 160),
        logo_url: input.logo_url,
        cover_image_url: input.cover_image_url,
        content: input.content,
        published: input.published,
    });

    if (error) {
        return { error: error.message };
    }

    redirect("/admin/dashboard");
}

export async function updateExperience(id: string, input: ExperienceInput) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("experiences")
        .update({
            slug: toSlug(`${input.organization}-${input.position_title}`),
            position_title: input.position_title,
            organization: input.organization,
            start_date: input.start_date,
            end_date: input.is_ongoing ? null : input.end_date,
            is_ongoing: input.is_ongoing,
            synopsis: input.synopsis.slice(0, 160),
            logo_url: input.logo_url,
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

export async function deleteExperience(id: string) {
    const supabase = await createClient();

    const { error } = await supabase.from("experiences").delete().eq("id", id);

    if (error) {
        return { error: error.message };
    }

    redirect("/admin/dashboard");
}
