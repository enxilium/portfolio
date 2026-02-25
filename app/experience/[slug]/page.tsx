import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Experience } from "@/app/lib/supabase/types";
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
    const { data: exp } = await supabase
        .from("experiences")
        .select("position_title, organization, synopsis")
        .eq("slug", slug)
        .eq("published", true)
        .single();

    if (!exp) return { title: "Not Found" };

    return {
        title: `${exp.position_title} at ${exp.organization}`,
        description: exp.synopsis,
    };
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
    });
}

export default async function ExperiencePage({ params }: PageProps) {
    const { slug } = await params;
    const supabase = await createClient();

    const { data } = await supabase
        .from("experiences")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single();

    if (!data) notFound();

    const exp = data as Experience;

    const period = exp.is_ongoing
        ? `${formatDate(exp.start_date)} — Present`
        : `${formatDate(exp.start_date)} — ${formatDate(exp.end_date!)}`;

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Cover image */}
            {exp.cover_image_url && (
                <div className="relative h-64 w-full sm:h-80 md:h-96">
                    <img
                        src={exp.cover_image_url}
                        alt={exp.position_title}
                        className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0a]" />
                </div>
            )}

            <article className="mx-auto max-w-2xl px-6 py-12">
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
                    <div className="flex items-center gap-4">
                        {exp.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={exp.logo_url}
                                alt={exp.organization}
                                className="h-10 w-10 rounded border border-white/10 object-cover"
                                style={{ filter: "grayscale(100%)" }}
                            />
                        )}
                        <h1
                            className="text-2xl font-semibold tracking-wide text-white sm:text-3xl"
                            style={{
                                fontFamily:
                                    "var(--font-open-sans), 'Avenir', sans-serif",
                                lineHeight: 1.3,
                            }}
                        >
                            {exp.position_title}
                        </h1>
                    </div>
                    <p
                        className="mt-3 text-xs tracking-[2px] uppercase text-white/35"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        {exp.organization} · {period}
                    </p>
                </header>

                {/* Content */}
                <div
                    className="content-body"
                    dangerouslySetInnerHTML={{ __html: exp.content }}
                />
            </article>
        </div>
    );
}
