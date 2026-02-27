"use client";

import ExperienceForm from "@/app/admin/components/ExperienceForm";
import { createExperience } from "@/app/admin/actions/experience";

export default function ExperienceFormWrapper() {
    return (
        <ExperienceForm
            draftKey="exp-new"
            submitLabel="Create Experience"
            onSubmit={async (data) => {
                const result = await createExperience(data);
                return result;
            }}
        />
    );
}
