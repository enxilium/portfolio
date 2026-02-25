// ── Supabase table row types ──
// These mirror the database schema. Keep in sync with the SQL migration.

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    synopsis: string;
    cover_image_url: string | null;
    content: string;
    published: boolean;
    created_at: string;
    updated_at: string;
}

export interface Experience {
    id: string;
    slug: string;
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
    created_at: string;
    updated_at: string;
}

// ── Form input types (used by create/update actions) ──

export interface BlogPostInput {
    title: string;
    synopsis: string;
    cover_image_url: string | null;
    content: string;
    published: boolean;
}

export interface ExperienceInput {
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
}
