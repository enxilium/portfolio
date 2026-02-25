"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Aspect ratio presets ──
// width / height — e.g. 16:9 cover = 1.778, 1:1 logo = 1
interface CropModalProps {
    /** The object URL or data URL of the source image */
    imageSrc: string;
    /** Desired output aspect ratio (width / height) */
    aspectRatio: number;
    /** Output width in px (height derived from aspect ratio) */
    outputWidth: number;
    /** Convert result to grayscale */
    grayscale?: boolean;
    /** Called with the final cropped blob */
    onCrop: (blob: Blob) => void;
    /** Close without cropping */
    onCancel: () => void;
}

export default function CropModal({
    imageSrc,
    aspectRatio,
    outputWidth,
    grayscale = false,
    onCrop,
    onCancel,
}: CropModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    // Natural dimensions of the loaded image
    const [naturalW, setNaturalW] = useState(0);
    const [naturalH, setNaturalH] = useState(0);

    // The scale at which the image is rendered so it fills the viewport
    const [scale, setScale] = useState(1);

    // Pan offset in *scaled* px (CSS translate)
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const offsetStart = useRef({ x: 0, y: 0 });

    // Crop viewport size (fixed on screen)
    const VIEWPORT_W = 400;
    const VIEWPORT_H = VIEWPORT_W / aspectRatio;

    // Once the image loads, compute the initial scale so the image
    // covers the viewport (like object-fit: cover)
    const handleImageLoad = useCallback(
        (e: React.SyntheticEvent<HTMLImageElement>) => {
            const img = e.currentTarget;
            setNaturalW(img.naturalWidth);
            setNaturalH(img.naturalHeight);

            const scaleX = VIEWPORT_W / img.naturalWidth;
            const scaleY = VIEWPORT_H / img.naturalHeight;
            const coverScale = Math.max(scaleX, scaleY);
            setScale(coverScale);

            // Centre the image
            const scaledW = img.naturalWidth * coverScale;
            const scaledH = img.naturalHeight * coverScale;
            setOffset({
                x: (VIEWPORT_W - scaledW) / 2,
                y: (VIEWPORT_H - scaledH) / 2,
            });

            imgRef.current = img;
        },
        [VIEWPORT_W, VIEWPORT_H],
    );

    // ── Pointer drag ──
    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            dragging.current = true;
            dragStart.current = { x: e.clientX, y: e.clientY };
            offsetStart.current = { ...offset };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [offset],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragging.current) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;

            const scaledW = naturalW * scale;
            const scaledH = naturalH * scale;

            // Clamp so the image always covers the viewport
            const minX = VIEWPORT_W - scaledW;
            const maxX = 0;
            const minY = VIEWPORT_H - scaledH;
            const maxY = 0;

            setOffset({
                x: Math.min(maxX, Math.max(minX, offsetStart.current.x + dx)),
                y: Math.min(maxY, Math.max(minY, offsetStart.current.y + dy)),
            });
        },
        [naturalW, naturalH, scale, VIEWPORT_W, VIEWPORT_H],
    );

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    // ── Scroll to zoom ──
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();

            const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
            const minScale = Math.max(
                VIEWPORT_W / naturalW,
                VIEWPORT_H / naturalH,
            );
            const newScale = Math.max(minScale, scale * zoomFactor);

            // Zoom towards the cursor position inside the viewport
            const rect = containerRef.current!.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            const ratio = newScale / scale;
            const newX = cx - ratio * (cx - offset.x);
            const newY = cy - ratio * (cy - offset.y);

            const scaledW = naturalW * newScale;
            const scaledH = naturalH * newScale;
            const clampedX = Math.min(0, Math.max(VIEWPORT_W - scaledW, newX));
            const clampedY = Math.min(0, Math.max(VIEWPORT_H - scaledH, newY));

            setScale(newScale);
            setOffset({ x: clampedX, y: clampedY });
        },
        [naturalW, naturalH, scale, offset, VIEWPORT_W, VIEWPORT_H],
    );

    // ── Crop & export ──
    const handleCrop = useCallback(() => {
        if (!imgRef.current) return;

        const outputHeight = Math.round(outputWidth / aspectRatio);
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext("2d")!;

        // The viewport maps to (0,0)→(VIEWPORT_W, VIEWPORT_H) on screen.
        // The image is at (offset.x, offset.y) with dimensions (naturalW*scale, naturalH*scale).
        // We need to find which region of the *natural* image is visible in the viewport.
        const srcX = -offset.x / scale;
        const srcY = -offset.y / scale;
        const srcW = VIEWPORT_W / scale;
        const srcH = VIEWPORT_H / scale;

        if (grayscale) {
            ctx.filter = "grayscale(100%)";
        }

        ctx.drawImage(
            imgRef.current,
            srcX,
            srcY,
            srcW,
            srcH,
            0,
            0,
            outputWidth,
            outputHeight,
        );

        canvas.toBlob(
            (blob) => {
                if (blob) onCrop(blob);
            },
            "image/webp",
            0.9,
        );
    }, [
        offset,
        scale,
        VIEWPORT_W,
        VIEWPORT_H,
        outputWidth,
        aspectRatio,
        grayscale,
        onCrop,
    ]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onCancel]);

    const monoFont = "var(--font-geist-mono), monospace";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5">
                {/* Instructions */}
                <p
                    className="text-xs tracking-[2px] uppercase text-white/50"
                    style={{ fontFamily: monoFont }}
                >
                    Drag to pan · Scroll to zoom
                </p>

                {/* Crop viewport */}
                <div
                    ref={containerRef}
                    className="relative cursor-grab overflow-hidden rounded border border-white/20 active:cursor-grabbing"
                    style={{
                        width: VIEWPORT_W,
                        height: VIEWPORT_H,
                        touchAction: "none",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onWheel={onWheel}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageSrc}
                        alt="Crop preview"
                        draggable={false}
                        onLoad={handleImageLoad}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            transformOrigin: "0 0",
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            maxWidth: "none",
                            filter: grayscale ? "grayscale(100%)" : undefined,
                            userSelect: "none",
                        }}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded border border-white/20 px-5 py-2 text-xs tracking-[3px] uppercase text-white/50 transition-colors hover:border-white/40 hover:text-white/80"
                        style={{ fontFamily: monoFont }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCrop}
                        className="rounded border border-white/40 bg-white/10 px-5 py-2 text-xs tracking-[3px] uppercase text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                        style={{ fontFamily: monoFont }}
                    >
                        Crop &amp; Upload
                    </button>
                </div>
            </div>
        </div>
    );
}
