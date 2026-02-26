"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        router.push("/admin/dashboard");
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <form
                onSubmit={handleLogin}
                className="flex w-full max-w-sm flex-col gap-5"
            >
                <h1
                    className="text-center text-xl tracking-[6px] uppercase"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        color: "rgba(255,255,255,0.5)",
                    }}
                >
                    {"// ADMIN"}
                </h1>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="rounded border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                />

                {error && (
                    <p
                        className="text-center text-xs text-red-400"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="rounded border border-white/30 bg-transparent px-4 py-3 text-sm tracking-[3px] uppercase text-white/70 transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    {loading ? "..." : "SIGN IN"}
                </button>
            </form>
        </div>
    );
}
