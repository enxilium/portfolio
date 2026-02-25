import type { Metadata } from "next";
import "./tiptap.css";

export const metadata: Metadata = {
    title: "Admin Panel",
    robots: "noindex, nofollow",
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
            {children}
        </div>
    );
}
