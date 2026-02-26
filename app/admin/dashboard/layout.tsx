import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/admin");
    }

    return <>{children}</>;
}
