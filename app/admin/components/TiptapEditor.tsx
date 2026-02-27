"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import FigureImage from "./FigureImageExtension";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useCallback, useState, useEffect } from "react";
import { createClient } from "@/app/lib/supabase/client";
import EditorContextMenu from "./EditorContextMenu";
import CropModal from "./CropModal";

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
    /** Timestamp of the last auto-save (displayed in fullscreen header) */
    lastSaved?: Date | null;
}

// ── Mono font constant ──
const MONO = "var(--font-geist-mono), monospace";

// ── Link modal sub-component ──
function LinkModal({
    initialText,
    initialUrl,
    onSubmit,
    onCancel,
}: {
    initialText: string;
    initialUrl: string;
    onSubmit: (text: string, url: string) => void;
    onCancel: () => void;
}) {
    const [text, setText] = useState(initialText);
    const [url, setUrl] = useState(initialUrl);
    const urlRef = useRef<HTMLInputElement>(null);

    // Focus URL field on mount (text is often pre-filled)
    useEffect(() => {
        urlRef.current?.focus();
    }, []);

    const doSubmit = () => {
        if (!url.trim()) return;
        onSubmit(text.trim(), url.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
        } else if (e.key === "Enter") {
            e.preventDefault();
            doSubmit();
        }
    };

    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                className="flex flex-col gap-3 rounded border border-white/20 bg-[#0a0a0a]/95 p-5 shadow-xl"
                style={{ minWidth: 360, fontFamily: MONO }}
                onKeyDown={handleKeyDown}
            >
                <span
                    className="text-[10px] tracking-[2px] uppercase text-white/30 mb-1"
                    style={{ fontFamily: MONO }}
                >
                    Insert Link
                </span>

                <label className="flex flex-col gap-1">
                    <span className="text-[10px] tracking-[1px] uppercase text-white/40">
                        Text
                    </span>
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Link text"
                        className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors"
                        style={{ fontFamily: MONO }}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-[10px] tracking-[1px] uppercase text-white/40">
                        URL
                    </span>
                    <input
                        ref={urlRef}
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://"
                        className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors"
                        style={{ fontFamily: MONO }}
                    />
                </label>

                <div className="flex justify-end gap-2 mt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded border border-white/15 px-4 py-1.5 text-xs text-white/40 transition-colors hover:border-white/30 hover:text-white/70"
                        style={{ fontFamily: MONO }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!url.trim()}
                        onClick={doSubmit}
                        className="rounded border border-white/30 bg-white/10 px-4 py-1.5 text-xs text-white/80 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ fontFamily: MONO }}
                    >
                        Insert
                    </button>
                </div>
            </div>
        </div>
    );
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

export default function TiptapEditor({
    content,
    onChange,
    lastSaved,
}: TiptapEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const handleImageUploadRef = useRef<(file: File) => void>(() => {});
    const openLinkModalRef = useRef<() => void>(() => {});

    // Context menu state (shared for text and image right-click)
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        type: "text" | "image";
        nodePos: number;
    } | null>(null);

    // Crop modal state (for images cropped via right-click menu)
    const [cropState, setCropState] = useState<{
        blobUrl: string;
        naturalWidth: number;
        nodePos: number;
    } | null>(null);

    // Link modal state
    const [linkModal, setLinkModal] = useState<{
        text: string;
        url: string;
    } | null>(null);

    // Helper: toggle fullscreen and clear stale context menu
    const toggleFullscreen = useCallback((value?: boolean) => {
        setIsFullscreen((prev) => {
            const next = value !== undefined ? value : !prev;
            if (next !== prev) setContextMenu(null);
            return next;
        });
    }, []);

    // Close fullscreen on Escape key (skip if another modal already handled it)
    useEffect(() => {
        if (!isFullscreen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !e.defaultPrevented)
                toggleFullscreen(false);
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isFullscreen, toggleFullscreen]);

    // Lock body scroll when fullscreen
    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isFullscreen]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            FigureImage,
            Link.configure({
                openOnClick: false,
                autolink: false,
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
            syncPreviewScroll(ed);
        },
        onSelectionUpdate: ({ editor: ed }) => {
            syncPreviewScroll(ed);
        },
        editorProps: {
            attributes: {
                class: "prose prose-invert max-w-none min-h-[300px] outline-none px-4 py-3 text-sm leading-relaxed",
            },
            handlePaste: (_view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;
                for (const item of items) {
                    if (item.type.startsWith("image/")) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        // Defer the upload + insertion to avoid flushSync during
                        // ProseMirror's update cycle (ReactNodeViewRenderer issue)
                        if (file) {
                            setTimeout(
                                () => handleImageUploadRef.current(file),
                                0,
                            );
                        }
                        return true;
                    }
                }
                return false;
            },
            handleTextInput: (view, from, to, text) => {
                // Auto-replace " - " with " — " (em dash)
                if (text === " " && from >= 2) {
                    const before = view.state.doc.textBetween(from - 2, from);
                    if (before === " -") {
                        const tr = view.state.tr
                            .delete(from - 2, from)
                            .insertText(" — ", from - 2);
                        view.dispatch(tr);
                        return true;
                    }
                }
                return false;
            },
            handleKeyDown: (_view, event) => {
                // Ctrl+K / Cmd+K → open link modal
                if ((event.ctrlKey || event.metaKey) && event.key === "k") {
                    event.preventDefault();
                    // Defer to avoid dispatch-during-dispatch
                    setTimeout(() => openLinkModalRef.current(), 0);
                    return true;
                }
                return false;
            },
        },
    });

    // ── Sync preview scroll to cursor position ──
    // Uses DOM-node matching: find which top-level block the cursor is in,
    // then scroll the corresponding child in the preview into view.
    const syncPreviewScroll = useCallback(
        (ed: ReturnType<typeof useEditor>) => {
            if (!ed) return;
            const preview = previewRef.current;
            if (!preview) return;

            try {
                const { from } = ed.state.selection;

                // Walk top-level nodes to find which one contains the cursor
                let blockIndex = -1;
                let cumulativePos = 0;
                ed.state.doc.forEach((node, _offset, index) => {
                    if (blockIndex >= 0) return; // already found
                    const nodeStart = cumulativePos + 1; // +1 for the opening token
                    const nodeEnd = nodeStart + node.nodeSize;
                    if (from >= nodeStart && from < nodeEnd) {
                        blockIndex = index;
                    }
                    cumulativePos += node.nodeSize;
                });

                if (blockIndex < 0) return;

                // Find the matching child element in the preview pane
                const previewChildren = preview.children;
                if (blockIndex < previewChildren.length) {
                    previewChildren[blockIndex].scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
                }
            } catch {
                /* can throw for positions not yet rendered */
            }
        },
        [],
    );

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

            // Defer the editor command to avoid flushSync issues when
            // ReactNodeViewRenderer tries to render during a ProseMirror update
            requestAnimationFrame(() => {
                editor.chain().focus().setImage({ src: publicUrl }).run();
            });
        },
        [editor],
    );

    // Keep ref in sync so the paste handler (captured at editor creation) can call this
    useEffect(() => {
        handleImageUploadRef.current = handleImageUpload;
    }, [handleImageUpload]);

    // ── Context menu handler — fires via React onContextMenu on editor pane ──
    const handleEditorContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            if (!editor) return;
            const target = e.target as HTMLElement;

            // Check if the click target is inside an image node view
            const imgEl =
                target.tagName === "IMG" ? target : target.closest("img");
            let imagePos: number | null = null;

            if (imgEl) {
                editor.state.doc.descendants((node, pos) => {
                    if (imagePos !== null) return false;
                    if (node.type.name === "image") {
                        try {
                            const dom = editor.view.nodeDOM(pos);
                            if (
                                dom &&
                                (dom === target ||
                                    (dom as HTMLElement).contains?.(target))
                            ) {
                                imagePos = pos;
                                return false;
                            }
                        } catch {
                            /* nodeDOM can throw for unmounted positions */
                        }
                    }
                });
            }

            if (imagePos !== null) {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: "image",
                    nodePos: imagePos,
                });
            } else {
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: "text",
                    nodePos: -1,
                });
            }
        },
        [editor],
    );

    // ── Crop flow (start / done / cancel) ──
    const handleStartCrop = useCallback(
        async (nodePos: number, src: string) => {
            try {
                const resp = await fetch(src);
                const blob = await resp.blob();
                const blobUrl = URL.createObjectURL(blob);
                const img = new window.Image();
                img.onload = () => {
                    setCropState({
                        blobUrl,
                        naturalWidth: img.naturalWidth,
                        nodePos,
                    });
                };
                img.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    console.error("Failed to load image for crop");
                };
                img.src = blobUrl;
            } catch (err) {
                console.error("Failed to fetch image for cropping:", err);
            }
        },
        [],
    );

    const handleCropDone = useCallback(
        async (blob: Blob) => {
            if (!editor || !cropState) return;
            URL.revokeObjectURL(cropState.blobUrl);
            const { nodePos } = cropState;
            setCropState(null);

            const supabase = createClient();
            const path = `content/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
            const { error } = await supabase.storage
                .from("uploads")
                .upload(path, blob);
            if (error) {
                console.error("Crop upload failed:", error.message);
                return;
            }
            const {
                data: { publicUrl },
            } = supabase.storage.from("uploads").getPublicUrl(path);

            const node = editor.state.doc.nodeAt(nodePos);
            if (node) {
                requestAnimationFrame(() => {
                    const tr = editor.state.tr.setNodeMarkup(
                        nodePos,
                        undefined,
                        { ...node.attrs, src: publicUrl },
                    );
                    editor.view.dispatch(tr);
                });
            }
        },
        [editor, cropState],
    );

    const handleCropCancel = useCallback(() => {
        if (cropState) URL.revokeObjectURL(cropState.blobUrl);
        setCropState(null);
    }, [cropState]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
        // Reset so the same file can be re-selected
        e.target.value = "";
    };

    // ── Add link (via modal) ──
    const openLinkModal = useCallback(() => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        const selectedText = empty
            ? ""
            : editor.state.doc.textBetween(from, to);
        const existingHref = editor.isActive("link")
            ? (editor.getAttributes("link").href as string) || ""
            : "";
        setLinkModal({
            text: selectedText,
            url: existingHref || "https://",
        });
    }, [editor]);

    // Keep ref in sync so handleKeyDown can call it
    useEffect(() => {
        openLinkModalRef.current = openLinkModal;
    }, [openLinkModal]);

    const handleLinkSubmit = useCallback(
        (text: string, url: string) => {
            if (!editor) return;
            setLinkModal(null);

            // Helper: after inserting a link, clear storedMarks so the next
            // character typed doesn't inherit the link mark.
            const clearLinkMark = () => {
                const { tr } = editor.state;
                const linkType = editor.schema.marks.link;
                const currentMarks =
                    editor.state.storedMarks ??
                    editor.state.selection.$from.marks();
                const withoutLink = currentMarks.filter(
                    (m) => m.type !== linkType,
                );
                editor.view.dispatch(tr.setStoredMarks(withoutLink));
            };

            if (editor.state.selection.empty && text) {
                // No selection — insert new text with link
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: "text",
                        text,
                        marks: [
                            {
                                type: "link",
                                attrs: { href: url },
                            },
                        ],
                    })
                    .run();
                clearLinkMark();
            } else if (!editor.state.selection.empty) {
                // Has selection — first replace text if changed, then apply link
                const { from, to } = editor.state.selection;
                const selectedText = editor.state.doc.textBetween(from, to);
                if (text && text !== selectedText) {
                    editor
                        .chain()
                        .focus()
                        .deleteSelection()
                        .insertContent({
                            type: "text",
                            text,
                            marks: [
                                {
                                    type: "link",
                                    attrs: { href: url },
                                },
                            ],
                        })
                        .run();
                    clearLinkMark();
                } else {
                    editor
                        .chain()
                        .focus()
                        .extendMarkRange("link")
                        .setLink({ href: url })
                        .run();
                    clearLinkMark();
                }
            } else {
                // No selection, no text — insert URL as link text
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: "text",
                        text: url,
                        marks: [
                            {
                                type: "link",
                                attrs: { href: url },
                            },
                        ],
                    })
                    .run();
                clearLinkMark();
            }
        },
        [editor],
    );

    const handleLinkCancel = useCallback(() => {
        setLinkModal(null);
        editor?.chain().focus().run();
    }, [editor]);

    // ── Add YouTube video ──
    const addVideo = useCallback(() => {
        if (!editor) return;
        const url = window.prompt("Enter YouTube URL:");
        if (!url) return;
        editor.commands.setYoutubeVideo({ src: url });
    }, [editor]);

    if (!editor) return null;

    const toolbarContent = (
        <div className="flex flex-wrap gap-1 border-b border-white/10 px-2 py-1.5">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")}
                title="Bold (Ctrl+B)"
            >
                B
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")}
                title="Italic (Ctrl+I)"
            >
                I
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive("strike")}
                title="Strikethrough (Ctrl+Shift+X)"
            >
                S
            </ToolbarButton>

            <span className="mx-1 border-l border-white/10" />

            <ToolbarButton
                onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                active={editor.isActive("heading", { level: 1 })}
                title="Heading 1 (Ctrl+Alt+1)"
            >
                H1
            </ToolbarButton>
            <ToolbarButton
                onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                active={editor.isActive("heading", { level: 2 })}
                title="Heading 2 (Ctrl+Alt+2)"
            >
                H2
            </ToolbarButton>
            <ToolbarButton
                onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                active={editor.isActive("heading", { level: 3 })}
                title="Heading 3 (Ctrl+Alt+3)"
            >
                H3
            </ToolbarButton>

            <span className="mx-1 border-l border-white/10" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")}
                title="Bullet List (Ctrl+Shift+8)"
            >
                • List
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive("orderedList")}
                title="Numbered List (Ctrl+Shift+7)"
            >
                1. List
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive("blockquote")}
                title="Quote (Ctrl+Shift+B)"
            >
                &ldquo; Quote
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                active={editor.isActive("codeBlock")}
                title="Code Block (Ctrl+Alt+C)"
            >
                {"</>"}
            </ToolbarButton>

            <span className="mx-1 border-l border-white/10" />

            <ToolbarButton onClick={openLinkModal} title="Add Link (Ctrl+K)">
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
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
            >
                —
            </ToolbarButton>

            {/* Spacer to push fullscreen toggle right */}
            <div className="flex-1" />

            <ToolbarButton
                onClick={() => toggleFullscreen()}
                title={
                    isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Editor"
                }
            >
                {isFullscreen ? "✕ Close" : "⛶ Expand"}
            </ToolbarButton>
        </div>
    );

    const editorPanes = (
        <div
            className={`grid grid-cols-2 divide-x divide-white/10 ${isFullscreen ? "flex-1 overflow-hidden" : ""}`}
        >
            {/* Editor pane */}
            <div
                className={`flex flex-col ${isFullscreen ? "overflow-auto" : ""}`}
                onContextMenu={handleEditorContextMenu}
            >
                <span
                    className="px-3 py-1.5 text-[10px] tracking-[2px] uppercase text-white/30 border-b border-white/5"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                    }}
                >
                    Edit
                </span>
                <EditorContent editor={editor} />
            </div>

            {/* Preview pane */}
            <div
                className={`flex flex-col ${isFullscreen ? "overflow-auto" : ""}`}
            >
                <span
                    className="px-3 py-1.5 text-[10px] tracking-[2px] uppercase text-white/30 border-b border-white/5"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                    }}
                >
                    Preview
                </span>
                <div
                    ref={previewRef}
                    className="content-body overflow-auto px-4 py-3 min-h-75"
                    dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
                />
            </div>
        </div>
    );

    const fileInput = (
        <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
        />
    );

    // ── Single tree — CSS toggles fullscreen, EditorContent never remounts ──
    return (
        <>
            {/* Placeholder to keep form layout when fullscreen */}
            <div
                className={
                    isFullscreen
                        ? "flex flex-col gap-0 rounded border border-white/15"
                        : "hidden"
                }
            >
                <div className="flex items-center justify-between px-3 py-3">
                    <span
                        className="text-xs text-white/30"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        Editor is open in fullscreen
                    </span>
                    <button
                        type="button"
                        onClick={() => toggleFullscreen(false)}
                        className="rounded border border-white/20 px-3 py-1 text-xs text-white/50 transition-colors hover:border-white/40 hover:text-white/80"
                        style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                        }}
                    >
                        Close Fullscreen
                    </button>
                </div>
            </div>

            {/* Editor container — always at same React tree position */}
            <div
                className={
                    isFullscreen
                        ? "fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
                        : "flex flex-col gap-0 rounded border border-white/15"
                }
            >
                {/* Header bar (fullscreen only) */}
                {isFullscreen && (
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                        <span
                            className="text-xs tracking-[2px] uppercase text-white/40"
                            style={{
                                fontFamily: "var(--font-geist-mono), monospace",
                            }}
                        >
                            Content Editor
                        </span>
                        <div className="flex items-center gap-4">
                            {lastSaved && (
                                <span
                                    className="text-[10px] tracking-[1px] text-white/20"
                                    style={{
                                        fontFamily:
                                            "var(--font-geist-mono), monospace",
                                    }}
                                >
                                    Draft saved{" "}
                                    {lastSaved.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            )}
                            <span
                                className="text-[10px] text-white/20"
                                style={{
                                    fontFamily:
                                        "var(--font-geist-mono), monospace",
                                }}
                            >
                                Esc to close
                            </span>
                        </div>
                    </div>
                )}

                {toolbarContent}
                {editorPanes}
                {fileInput}

                {/* Context menu */}
                {contextMenu && (
                    <EditorContextMenu
                        editor={editor}
                        position={{ x: contextMenu.x, y: contextMenu.y }}
                        context={contextMenu.type}
                        imageNodePos={contextMenu.nodePos}
                        onClose={() => setContextMenu(null)}
                        onStartCrop={handleStartCrop}
                        onInsertImage={() => fileInputRef.current?.click()}
                    />
                )}

                {/* Crop modal */}
                {cropState && (
                    <CropModal
                        imageSrc={cropState.blobUrl}
                        outputWidth={Math.min(cropState.naturalWidth, 1600)}
                        onCrop={handleCropDone}
                        onCancel={handleCropCancel}
                    />
                )}

                {/* Link modal */}
                {linkModal && (
                    <LinkModal
                        initialText={linkModal.text}
                        initialUrl={linkModal.url}
                        onSubmit={handleLinkSubmit}
                        onCancel={handleLinkCancel}
                    />
                )}
            </div>
        </>
    );
}
