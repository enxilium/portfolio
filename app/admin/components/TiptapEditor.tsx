"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useCallback } from "react";
import { createClient } from "@/app/lib/supabase/client";

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
}

// ── Toolbar button ──
function ToolbarButton({
    onClick,
    active,
    children,
    title,
}: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="rounded px-2 py-1 text-xs transition-colors"
            style={{
                fontFamily: "var(--font-geist-mono), monospace",
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.5)",
            }}
        >
            {children}
        </button>
    );
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Image.configure({ inline: false }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    rel: "noopener noreferrer",
                    target: "_blank",
                },
            }),
            Youtube.configure({ inline: false }),
            Placeholder.configure({
                placeholder: "Write your content here...",
            }),
        ],
        content,
        onUpdate: ({ editor: ed }) => {
            onChange(ed.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose prose-invert max-w-none min-h-[300px] outline-none px-4 py-3 text-sm leading-relaxed",
            },
        },
    });

    // ── Image upload handler ──
    const handleImageUpload = useCallback(
        async (file: File) => {
            if (!editor) return;
            const supabase = createClient();
            const ext = file.name.split(".").pop();
            const path = `content/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

            const { error } = await supabase.storage
                .from("uploads")
                .upload(path, file);

            if (error) {
                console.error("Image upload failed:", error.message);
                return;
            }

            const {
                data: { publicUrl },
            } = supabase.storage.from("uploads").getPublicUrl(path);

            editor.chain().focus().setImage({ src: publicUrl }).run();
        },
        [editor],
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
        // Reset so the same file can be re-selected
        e.target.value = "";
    };

    // ── Add link ──
    const addLink = useCallback(() => {
        if (!editor) return;
        const url = window.prompt("Enter URL:");
        if (!url) return;
        editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
    }, [editor]);

    // ── Add YouTube video ──
    const addVideo = useCallback(() => {
        if (!editor) return;
        const url = window.prompt("Enter YouTube URL:");
        if (!url) return;
        editor.commands.setYoutubeVideo({ src: url });
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="flex flex-col gap-0 rounded border border-white/15">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 border-b border-white/10 px-2 py-1.5">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    active={editor.isActive("bold")}
                    title="Bold"
                >
                    B
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    active={editor.isActive("italic")}
                    title="Italic"
                >
                    I
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    active={editor.isActive("strike")}
                    title="Strikethrough"
                >
                    S
                </ToolbarButton>

                <span className="mx-1 border-l border-white/10" />

                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                    active={editor.isActive("heading", { level: 1 })}
                    title="Heading 1"
                >
                    H1
                </ToolbarButton>
                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                    active={editor.isActive("heading", { level: 2 })}
                    title="Heading 2"
                >
                    H2
                </ToolbarButton>
                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleHeading({ level: 3 }).run()
                    }
                    active={editor.isActive("heading", { level: 3 })}
                    title="Heading 3"
                >
                    H3
                </ToolbarButton>

                <span className="mx-1 border-l border-white/10" />

                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleBulletList().run()
                    }
                    active={editor.isActive("bulletList")}
                    title="Bullet List"
                >
                    • List
                </ToolbarButton>
                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleOrderedList().run()
                    }
                    active={editor.isActive("orderedList")}
                    title="Numbered List"
                >
                    1. List
                </ToolbarButton>
                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleBlockquote().run()
                    }
                    active={editor.isActive("blockquote")}
                    title="Quote"
                >
                    &ldquo; Quote
                </ToolbarButton>
                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().toggleCodeBlock().run()
                    }
                    active={editor.isActive("codeBlock")}
                    title="Code Block"
                >
                    {"</>"}
                </ToolbarButton>

                <span className="mx-1 border-l border-white/10" />

                <ToolbarButton onClick={addLink} title="Add Link">
                    Link
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert Image"
                >
                    Image
                </ToolbarButton>
                <ToolbarButton onClick={addVideo} title="Embed YouTube video">
                    Video
                </ToolbarButton>

                <span className="mx-1 border-l border-white/10" />

                <ToolbarButton
                    onClick={() =>
                        editor.chain().focus().setHorizontalRule().run()
                    }
                    title="Horizontal Rule"
                >
                    —
                </ToolbarButton>
            </div>

            {/* Editor area */}
            <EditorContent editor={editor} />

            {/* Hidden file input for image uploads */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}
