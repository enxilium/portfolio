"use client";

import { useRef, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import CropModal from "./CropModal";

interface ImageUploadProps {
    value: string | null;
    onChange: (url: string | null) => void;
    /** Label shown above the upload area */
    label?: string;
    /** Aspect ratio for the crop viewport (width / height). Default 16:9. */
    aspectRatio?: number;
    /** Output width in px. Default 1200. */
    outputWidth?: number;
    /** Apply grayscale filter to the cropped output. */
    grayscale?: boolean;
    /** Supabase storage sub-folder. Default "covers". */
    storagePath?: string;
    /** Height of the preview / drop zone. Default "h-32". */
    previewHeight?: string;
    /** How to display the preview image. Default "cover". */
    previewMode?: "cover" | "contain";
}

export default function ImageUpload({
    value,
    onChange,
    label = "Cover Image",
    aspectRatio = 3.5,
    outputWidth = 1920,
    grayscale = false,
    storagePath = "covers",
    previewHeight = "h-32",
    previewMode = "cover",
}: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Upload the final cropped blob to Supabase
    const uploadBlob = async (blob: Blob) => {
        setUploading(true);
        setCropSrc(null);

        const supabase = createClient();
        const ext = "webp";
        const path = `${storagePath}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage
            .from("uploads")
            .upload(path, blob, { contentType: "image/webp" });

        if (error) {
            console.error("Upload failed:", error.message);
            setUploading(false);
            return;
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("uploads").getPublicUrl(path);

        onChange(publicUrl);
        setUploading(false);
    };

    // When file is selected, open the crop modal instead of uploading directly
    const openCropper = (file: File) => {
        const url = URL.createObjectURL(file);
        setCropSrc(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) openCropper(file);
        // Reset so the same file can be re-selected
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) openCropper(file);
    };

    return (
        <>
            <div className="flex flex-col gap-2">
                <label
                    className="text-xs tracking-[2px] uppercase text-white/40"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                    }}
                >
                    {label}
                </label>

                {value ? (
                    <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={value}
                            alt={`${label} preview`}
                            className={`w-full rounded border border-white/10 ${previewHeight}`}
                            style={{
                                objectFit: previewMode,
                                filter: grayscale
                                    ? "grayscale(100%)"
                                    : undefined,
                                background:
                                    previewMode === "contain"
                                        ? "rgba(255,255,255,0.03)"
                                        : undefined,
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="absolute top-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white/70 transition-colors hover:text-white"
                            style={{
                                fontFamily: "var(--font-geist-mono), monospace",
                            }}
                        >
                            Remove
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className={`flex cursor-pointer items-center justify-center rounded border border-dashed border-white/15 text-sm text-white/30 transition-colors hover:border-white/30 hover:text-white/50 ${previewHeight}`}
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        {uploading
                            ? "Uploading..."
                            : "Drop image or click to upload"}
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* Crop modal */}
            {cropSrc && (
                <CropModal
                    imageSrc={cropSrc}
                    aspectRatio={aspectRatio}
                    outputWidth={outputWidth}
                    grayscale={grayscale}
                    onCrop={(blob) => {
                        URL.revokeObjectURL(cropSrc);
                        uploadBlob(blob);
                    }}
                    onCancel={() => {
                        URL.revokeObjectURL(cropSrc);
                        setCropSrc(null);
                    }}
                />
            )}
        </>
    );
}
