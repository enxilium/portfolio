"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";

// ── Mono font constant ──
const MONO = "var(--font-geist-mono), monospace";

// ── Shared sub-components ──

function MenuItem({
    onClick,
    children,
    active,
    danger,
}: {
    onClick: () => void;
    children: React.ReactNode;
    active?: boolean;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                danger
                    ? "text-red-400/70 hover:bg-white/10 hover:text-red-400"
                    : active
                      ? "text-white bg-white/5"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
            style={{ fontFamily: MONO }}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function MenuDivider() {
    return <div className="my-1 border-t border-white/10" />;
}

function MenuLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="px-3 py-1 text-[10px] tracking-[2px] uppercase text-white/25"
            style={{ fontFamily: MONO }}
        >
            {children}
        </div>
    );
}

// ── Props ──

interface EditorContextMenuProps {
    editor: Editor;
    position: { x: number; y: number };
    context: "text" | "image";
    /** ProseMirror doc position of the image node (-1 for text) */
    imageNodePos: number;
    onClose: () => void;
    onStartCrop: (nodePos: number, src: string) => void;
    onInsertImage: () => void;
}

export default function EditorContextMenu({
    editor,
    position,
    context,
    imageNodePos,
    onClose,
    onStartCrop,
    onInsertImage,
}: EditorContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // ── Close on outside click or Escape ──
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        // Delay to avoid the initial right-click mousedown from closing
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClick);
            document.addEventListener("keydown", handleKey, true);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey, true);
        };
    }, [onClose]);

    // ── Compute position to stay on screen ──
    const [adjustedPos, setAdjustedPos] = useState(position);
    const positionApplied = useRef(false);
    useEffect(() => {
        // Wait one frame so the menu has rendered and we can measure it
        const raf = requestAnimationFrame(() => {
            if (!menuRef.current || positionApplied.current) return;
            positionApplied.current = true;
            const rect = menuRef.current.getBoundingClientRect();
            let { x, y } = position;
            if (x + rect.width > window.innerWidth - 8)
                x = window.innerWidth - rect.width - 8;
            if (y + rect.height > window.innerHeight - 8)
                y = window.innerHeight - rect.height - 8;
            setAdjustedPos({ x: Math.max(8, x), y: Math.max(8, y) });
        });
        return () => cancelAnimationFrame(raf);
    }, [position]);

    // ── Image helpers ──

    const getImageNode = useCallback(() => {
        if (imageNodePos < 0) return null;
        return editor.state.doc.nodeAt(imageNodePos);
    }, [editor, imageNodePos]);

    const updateImageAttr = useCallback(
        (attrs: Record<string, unknown>) => {
            const node = getImageNode();
            if (!node) return;
            const tr = editor.state.tr.setNodeMarkup(imageNodePos, undefined, {
                ...node.attrs,
                ...attrs,
            });
            editor.view.dispatch(tr);
        },
        [editor, imageNodePos, getImageNode],
    );

    const deleteImage = useCallback(() => {
        const node = getImageNode();
        if (!node) return;
        const tr = editor.state.tr.delete(
            imageNodePos,
            imageNodePos + node.nodeSize,
        );
        editor.view.dispatch(tr);
        onClose();
    }, [editor, imageNodePos, getImageNode, onClose]);

    // ── Link helpers ──

    const isLink = editor.isActive("link");
    const currentHref = isLink
        ? (editor.getAttributes("link").href as string | undefined)
        : undefined;

    const addOrEditLink = useCallback(() => {
        const url = window.prompt("Enter URL:", currentHref || "https://");
        if (url === null) return;
        if (!url.trim()) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
        }
        onClose();
    }, [editor, currentHref, onClose]);

    const removeLink = useCallback(() => {
        editor.chain().focus().unsetLink().run();
        onClose();
    }, [editor, onClose]);

    // ── YouTube ──

    const addVideo = useCallback(() => {
        const url = window.prompt("Enter YouTube URL:");
        if (!url) return;
        editor.commands.setYoutubeVideo({ src: url });
        onClose();
    }, [editor, onClose]);

    const menuClass =
        "fixed z-[100] flex flex-col rounded border border-white/20 bg-[#0a0a0a]/95 backdrop-blur-sm py-1 shadow-xl";

    // ═══════════════════════════════════════════════
    //  IMAGE CONTEXT MENU
    // ═══════════════════════════════════════════════
    if (context === "image") {
        const node = getImageNode();
        const attrs = node?.attrs;
        const caption = (attrs?.caption as string) ?? null;
        const alt = (attrs?.alt as string) ?? null;
        const width = (attrs?.width as number) ?? null;
        const src = attrs?.src as string;

        return (
            <div
                ref={menuRef}
                className={menuClass}
                style={{
                    left: adjustedPos.x,
                    top: adjustedPos.y,
                    minWidth: 200,
                }}
            >
                <MenuLabel>Image</MenuLabel>

                <MenuItem
                    onClick={() => {
                        const value = window.prompt("Caption:", caption || "");
                        if (value !== null) {
                            updateImageAttr({
                                caption: value.trim() || null,
                            });
                        }
                        onClose();
                    }}
                >
                    {caption ? "Edit Caption..." : "Add Caption..."}
                </MenuItem>

                {caption && (
                    <MenuItem
                        onClick={() => {
                            updateImageAttr({ caption: null });
                            onClose();
                        }}
                    >
                        Remove Caption
                    </MenuItem>
                )}

                <MenuItem
                    onClick={() => {
                        const value = window.prompt("Alt text:", alt || "");
                        if (value !== null) {
                            updateImageAttr({ alt: value.trim() || null });
                        }
                        onClose();
                    }}
                >
                    {alt ? "Edit Alt Text..." : "Add Alt Text..."}
                </MenuItem>

                <MenuDivider />

                {width && (
                    <MenuItem
                        onClick={() => {
                            updateImageAttr({ width: null });
                            onClose();
                        }}
                    >
                        Reset Size
                    </MenuItem>
                )}

                <MenuItem
                    onClick={() => {
                        onClose();
                        onStartCrop(imageNodePos, src);
                    }}
                >
                    Crop Image...
                </MenuItem>

                <MenuDivider />

                <MenuItem danger onClick={deleteImage}>
                    Delete Image
                </MenuItem>
            </div>
        );
    }

    // ═══════════════════════════════════════════════
    //  TEXT CONTEXT MENU
    // ═══════════════════════════════════════════════
    const hasSelection = !editor.state.selection.empty;

    return (
        <div
            ref={menuRef}
            className={menuClass}
            style={{
                left: adjustedPos.x,
                top: adjustedPos.y,
                minWidth: 180,
            }}
        >
            {/* Formatting */}
            <MenuLabel>Format</MenuLabel>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleBold().run();
                    onClose();
                }}
                active={editor.isActive("bold")}
            >
                Bold
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleItalic().run();
                    onClose();
                }}
                active={editor.isActive("italic")}
            >
                Italic
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleStrike().run();
                    onClose();
                }}
                active={editor.isActive("strike")}
            >
                Strikethrough
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleCode().run();
                    onClose();
                }}
                active={editor.isActive("code")}
            >
                Inline Code
            </MenuItem>

            <MenuDivider />

            {/* Links */}
            {isLink ? (
                <>
                    <MenuItem onClick={addOrEditLink}>Edit Link...</MenuItem>
                    <MenuItem onClick={removeLink}>Remove Link</MenuItem>
                </>
            ) : (
                <MenuItem onClick={addOrEditLink}>
                    {hasSelection ? "Add Link..." : "Insert Link..."}
                </MenuItem>
            )}

            <MenuDivider />

            {/* Block types */}
            <MenuLabel>Block</MenuLabel>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                    onClose();
                }}
                active={editor.isActive("heading", { level: 1 })}
            >
                Heading 1
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 2 }).run();
                    onClose();
                }}
                active={editor.isActive("heading", { level: 2 })}
            >
                Heading 2
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 3 }).run();
                    onClose();
                }}
                active={editor.isActive("heading", { level: 3 })}
            >
                Heading 3
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleBulletList().run();
                    onClose();
                }}
                active={editor.isActive("bulletList")}
            >
                Bullet List
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleOrderedList().run();
                    onClose();
                }}
                active={editor.isActive("orderedList")}
            >
                Ordered List
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleBlockquote().run();
                    onClose();
                }}
                active={editor.isActive("blockquote")}
            >
                Blockquote
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().toggleCodeBlock().run();
                    onClose();
                }}
                active={editor.isActive("codeBlock")}
            >
                Code Block
            </MenuItem>

            <MenuDivider />

            {/* Insert */}
            <MenuLabel>Insert</MenuLabel>
            <MenuItem
                onClick={() => {
                    onClose();
                    onInsertImage();
                }}
            >
                Image...
            </MenuItem>
            <MenuItem
                onClick={() => {
                    onClose();
                    addVideo();
                }}
            >
                YouTube Video...
            </MenuItem>
            <MenuItem
                onClick={() => {
                    editor.chain().focus().setHorizontalRule().run();
                    onClose();
                }}
            >
                Horizontal Rule
            </MenuItem>
        </div>
    );
}
