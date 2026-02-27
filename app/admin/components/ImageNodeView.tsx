"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState, useCallback, useRef, useEffect } from "react";

// ── Mono font constant ──
const MONO = "var(--font-geist-mono), monospace";

// Minimum width during drag resize (px)
const MIN_WIDTH = 80;

/**
 * React NodeView for images inside the Tiptap editor.
 *
 * Responsibilities:
 *  - Visual rendering (img + optional caption)
 *  - Selected-state outline
 *  - Click-to-edit caption (for captions that already exist)
 *  - Drag-to-resize via bottom-right handle (maintains aspect ratio)
 *
 * The right-click context menu (caption/crop/delete)
 * is handled at the editor level via EditorContextMenu.
 */
export default function ImageNodeView({
    node,
    updateAttributes,
    selected,
}: NodeViewProps) {
    const { src, alt, caption, width } = node.attrs;

    // ── Inline caption editing (click existing caption to edit) ──
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [captionDraft, setCaptionDraft] = useState(caption || "");

    const saveCaption = useCallback(() => {
        updateAttributes({ caption: captionDraft.trim() || null });
        setIsEditingCaption(false);
    }, [captionDraft, updateAttributes]);

    // ── Drag-to-resize state ──
    const imgRef = useRef<HTMLImageElement>(null);
    const [dragWidth, setDragWidth] = useState<number | null>(null);
    const [imgAspectRatio, setImgAspectRatio] = useState(1);
    const dragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartW = useRef(0);

    // Capture aspect ratio when image loads
    const handleImgLoad = useCallback(() => {
        if (imgRef.current) {
            const { naturalWidth, naturalHeight } = imgRef.current;
            if (naturalHeight > 0) {
                setImgAspectRatio(naturalWidth / naturalHeight);
            }
        }
    }, []);

    const onResizePointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!imgRef.current) return;

            dragging.current = true;
            dragStartX.current = e.clientX;
            // Use displayed width (accounts for CSS max-width clamping)
            dragStartW.current =
                width || imgRef.current.getBoundingClientRect().width;
            setDragWidth(dragStartW.current);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [width],
    );

    const onResizePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const dx = e.clientX - dragStartX.current;
        const newW = Math.max(MIN_WIDTH, Math.round(dragStartW.current + dx));
        setDragWidth(newW);
    }, []);

    const onResizePointerUp = useCallback(() => {
        if (!dragging.current) return;
        dragging.current = false;
        if (dragWidth !== null) {
            updateAttributes({ width: dragWidth });
        }
        setDragWidth(null);
    }, [dragWidth, updateAttributes]);

    // Clean up if component unmounts mid-drag
    useEffect(() => {
        return () => {
            dragging.current = false;
        };
    }, []);

    const displayWidth = dragWidth ?? (width || undefined);

    return (
        <NodeViewWrapper as="figure" className="image-figure" data-drag-handle>
            <div
                style={{
                    position: "relative",
                    display: "inline-block",
                    maxWidth: "100%",
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt || ""}
                    onLoad={handleImgLoad}
                    style={{
                        width: displayWidth ? `${displayWidth}px` : undefined,
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                        borderRadius: "0.375rem",
                        outline: selected
                            ? "2px solid rgba(255,255,255,0.4)"
                            : undefined,
                        outlineOffset: 2,
                        cursor: "default",
                        userSelect: "none",
                    }}
                    draggable={false}
                />

                {/* Resize handle — bottom-right corner */}
                {selected && (
                    <div
                        style={{
                            position: "absolute",
                            right: -4,
                            bottom: -4,
                            width: 12,
                            height: 12,
                            background: "rgba(255,255,255,0.9)",
                            border: "1.5px solid rgba(0,0,0,0.3)",
                            borderRadius: 2,
                            cursor: "nwse-resize",
                            touchAction: "none",
                            zIndex: 10,
                        }}
                        onPointerDown={onResizePointerDown}
                        onPointerMove={onResizePointerMove}
                        onPointerUp={onResizePointerUp}
                        onPointerCancel={onResizePointerUp}
                    />
                )}

                {/* Width indicator while dragging */}
                {dragWidth !== null && (
                    <span
                        style={{
                            position: "absolute",
                            bottom: -22,
                            right: 0,
                            fontFamily: MONO,
                            fontSize: "10px",
                            color: "rgba(255,255,255,0.5)",
                            background: "rgba(0,0,0,0.7)",
                            padding: "1px 5px",
                            borderRadius: 3,
                            pointerEvents: "none",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {dragWidth} × {Math.round(dragWidth / imgAspectRatio)}
                    </span>
                )}
            </div>

            {/* Caption: inline editing when clicked, or static display */}
            {isEditingCaption ? (
                <input
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    onBlur={saveCaption}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") saveCaption();
                        if (e.key === "Escape") {
                            setCaptionDraft(caption || "");
                            setIsEditingCaption(false);
                        }
                    }}
                    autoFocus
                    placeholder="Enter caption..."
                    className="mt-1.5 w-full bg-transparent text-center text-xs text-white/50 outline-none border-b border-white/20 pb-0.5"
                    style={{ fontFamily: MONO }}
                />
            ) : caption ? (
                <figcaption
                    className="mt-1.5 text-center text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors"
                    style={{ fontFamily: MONO }}
                    onClick={() => {
                        setCaptionDraft(caption);
                        setIsEditingCaption(true);
                    }}
                    title="Click to edit caption"
                >
                    {caption}
                </figcaption>
            ) : null}
        </NodeViewWrapper>
    );
}
