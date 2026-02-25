"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

export default function DashboardClient() {
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/admin");
    };

    return (
        <button
            onClick={handleSignOut}
            className="rounded border border-white/15 px-3 py-1.5 text-xs tracking-[2px] uppercase text-white/40 transition-colors hover:border-white/40 hover:text-white/70"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
            Sign Out
        </button>
    );
}
