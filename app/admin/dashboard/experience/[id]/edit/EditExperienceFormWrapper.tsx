"use client";

import ExperienceForm from "@/app/admin/components/ExperienceForm";
import {
    updateExperience,
    deleteExperience,
} from "@/app/admin/actions/experience";
import type { Experience } from "@/app/lib/supabase/types";

interface EditExperienceFormWrapperProps {
    experience: Experience;
}

export default function EditExperienceFormWrapper({
    experience,
}: EditExperienceFormWrapperProps) {
    return (
        <ExperienceForm
            draftKey={`exp-${experience.id}`}
            initial={{
                position_title: experience.position_title,
                organization: experience.organization,
                start_date: experience.start_date,
                end_date: experience.end_date,
                is_ongoing: experience.is_ongoing,
                synopsis: experience.synopsis,
                logo_url: experience.logo_url,
                cover_image_url: experience.cover_image_url,
                content: experience.content,
                published: experience.published,
            }}
            submitLabel="Save Changes"
            onSubmit={async (data) => {
                const result = await updateExperience(experience.id, data);
                return result;
            }}
            onDelete={async () => {
                const result = await deleteExperience(experience.id);
                return result;
            }}
        />
    );
}
