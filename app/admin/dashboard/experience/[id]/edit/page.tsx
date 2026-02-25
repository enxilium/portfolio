import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Experience } from "@/app/lib/supabase/types";
import EditExperienceFormWrapper from "./EditExperienceFormWrapper";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditExperiencePage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: exp } = await supabase
        .from("experiences")
        .select("*")
        .eq("id", id)
        .single();

    if (!exp) notFound();

    const experience = exp as Experience;

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
                    Edit Experience
                </h1>
            </div>

            <EditExperienceFormWrapper experience={experience} />
        </div>
    );
}
