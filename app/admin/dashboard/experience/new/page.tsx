import Link from "next/link";
import ExperienceFormWrapper from "./ExperienceFormWrapper";

export default function NewExperiencePage() {
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
                    New Experience
                </h1>
            </div>

            <ExperienceFormWrapper />
        </div>
    );
}
