"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CropModalProps {
    /** The object URL or data URL of the source image */
    imageSrc: string;
    /**
     * Desired output aspect ratio (width / height).
     * When omitted the crop box is free-form (any ratio).
     */
    aspectRatio?: number;
    /** Output width in px (height derived from crop region) */
    outputWidth: number;
    /** Convert result to grayscale */
    grayscale?: boolean;
    /** Called with the final cropped blob */
    onCrop: (blob: Blob) => void;
    /** Close without cropping */
    onCancel: () => void;
}

// Maximum display area for the full image
const MAX_DISPLAY_W = 600;
const MAX_DISPLAY_H = 500;

// Minimum crop box dimension in display-px
const MIN_CROP = 40;

export default function CropModal({
    imageSrc,
    aspectRatio,
    outputWidth,
    grayscale = false,
    onCrop,
    onCancel,
}: CropModalProps) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const locked = aspectRatio !== undefined;

    // Natural image dimensions
    const [naturalW, setNaturalW] = useState(0);
    const [naturalH, setNaturalH] = useState(0);

    // Scale at which the full image is displayed (fit inside MAX bounds)
    const [displayScale, setDisplayScale] = useState(1);

    // Displayed image dimensions
    const [displayW, setDisplayW] = useState(0);
    const [displayH, setDisplayH] = useState(0);

    // Crop box position (top-left corner, in display-px)
    const [cropX, setCropX] = useState(0);
    const [cropY, setCropY] = useState(0);

    // Crop box dimensions in display-px
    const [cropW, setCropW] = useState(0);
    const [cropH, setCropH] = useState(0);

    // Drag state (move crop box)
    const dragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const cropStart = useRef({ x: 0, y: 0 });

    // Corner-resize drag state
    const resizing = useRef<string | null>(null);
    const resizeStart = useRef({
        x: 0,
        y: 0,
        cropX: 0,
        cropY: 0,
        cropW: 0,
        cropH: 0,
    });

    // Load image and compute layout
    const handleImageLoad = useCallback(
        (e: React.SyntheticEvent<HTMLImageElement>) => {
            const img = e.currentTarget;
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            setNaturalW(nw);
            setNaturalH(nh);
            imgRef.current = img;

            // Scale image to fit inside max display bounds
            const scale = Math.min(MAX_DISPLAY_W / nw, MAX_DISPLAY_H / nh, 1);
            setDisplayScale(scale);

            const dw = Math.round(nw * scale);
            const dh = Math.round(nh * scale);
            setDisplayW(dw);
            setDisplayH(dh);

            // Compute the largest crop box that fits
            let cw: number;
            let ch: number;
            if (locked) {
                if (dw / dh > aspectRatio) {
                    ch = dh;
                    cw = Math.round(ch * aspectRatio);
                } else {
                    cw = dw;
                    ch = Math.round(cw / aspectRatio);
                }
            } else {
                // Free-form: start at full image
                cw = dw;
                ch = dh;
            }

            setCropW(cw);
            setCropH(ch);
            setCropX(Math.round((dw - cw) / 2));
            setCropY(Math.round((dh - ch) / 2));
        },
        [aspectRatio, locked],
    );

    // ── Drag the crop box (move) ──
    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            // Ignore if a corner handle started the interaction
            if (resizing.current) return;
            dragging.current = true;
            dragStart.current = { x: e.clientX, y: e.clientY };
            cropStart.current = { x: cropX, y: cropY };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [cropX, cropY],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragging.current) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;

            setCropX(
                Math.min(
                    displayW - cropW,
                    Math.max(0, cropStart.current.x + dx),
                ),
            );
            setCropY(
                Math.min(
                    displayH - cropH,
                    Math.max(0, cropStart.current.y + dy),
                ),
            );
        },
        [displayW, displayH, cropW, cropH],
    );

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    // ── Corner resize handlers ──
    const onCornerPointerDown = useCallback(
        (corner: string, e: React.PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            resizing.current = corner;
            resizeStart.current = {
                x: e.clientX,
                y: e.clientY,
                cropX,
                cropY,
                cropW,
                cropH,
            };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [cropX, cropY, cropW, cropH],
    );

    const onCornerPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!resizing.current) return;
            const corner = resizing.current;
            const s = resizeStart.current;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;

            let newX = s.cropX;
            let newY = s.cropY;
            let newW = s.cropW;
            let newH = s.cropH;

            if (locked) {
                // Locked aspect ratio: derive height from width
                if (corner === "br") {
                    newW = Math.max(MIN_CROP, s.cropW + dx);
                    newH = Math.round(newW / aspectRatio!);
                } else if (corner === "bl") {
                    const dw = -dx;
                    newW = Math.max(MIN_CROP, s.cropW + dw);
                    newH = Math.round(newW / aspectRatio!);
                    newX = s.cropX + s.cropW - newW;
                } else if (corner === "tr") {
                    newW = Math.max(MIN_CROP, s.cropW + dx);
                    newH = Math.round(newW / aspectRatio!);
                    newY = s.cropY + s.cropH - newH;
                } else if (corner === "tl") {
                    const dw = -dx;
                    newW = Math.max(MIN_CROP, s.cropW + dw);
                    newH = Math.round(newW / aspectRatio!);
                    newX = s.cropX + s.cropW - newW;
                    newY = s.cropY + s.cropH - newH;
                }
            } else {
                // Free-form: width and height move independently
                if (corner === "br") {
                    newW = Math.max(MIN_CROP, s.cropW + dx);
                    newH = Math.max(MIN_CROP, s.cropH + dy);
                } else if (corner === "bl") {
                    newW = Math.max(MIN_CROP, s.cropW - dx);
                    newH = Math.max(MIN_CROP, s.cropH + dy);
                    newX = s.cropX + s.cropW - newW;
                } else if (corner === "tr") {
                    newW = Math.max(MIN_CROP, s.cropW + dx);
                    newH = Math.max(MIN_CROP, s.cropH - dy);
                    newY = s.cropY + s.cropH - newH;
                } else if (corner === "tl") {
                    newW = Math.max(MIN_CROP, s.cropW - dx);
                    newH = Math.max(MIN_CROP, s.cropH - dy);
                    newX = s.cropX + s.cropW - newW;
                    newY = s.cropY + s.cropH - newH;
                }
            }

            // Clamp to image bounds
            if (newX < 0) {
                newW += newX;
                newX = 0;
            }
            if (newY < 0) {
                newH += newY;
                newY = 0;
            }
            if (newX + newW > displayW) newW = displayW - newX;
            if (newY + newH > displayH) newH = displayH - newY;

            setCropX(newX);
            setCropY(newY);
            setCropW(Math.max(MIN_CROP, newW));
            setCropH(Math.max(MIN_CROP, newH));
        },
        [displayW, displayH, locked, aspectRatio],
    );

    const onCornerPointerUp = useCallback(() => {
        resizing.current = null;
    }, []);

    // ── Scroll to resize crop box ──
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();

            const zoomFactor = e.deltaY < 0 ? 1.06 : 1 / 1.06;

            const minCW = Math.min(MIN_CROP, displayW);
            const maxCW = displayW;
            let newCW = Math.round(cropW * zoomFactor);
            newCW = Math.max(minCW, Math.min(maxCW, newCW));

            let newCH: number;
            if (locked) {
                newCH = Math.round(newCW / aspectRatio!);
                if (newCH > displayH) {
                    newCH = displayH;
                    newCW = Math.round(newCH * aspectRatio!);
                }
            } else {
                newCH = Math.round(cropH * zoomFactor);
                newCH = Math.max(
                    Math.min(MIN_CROP, displayH),
                    Math.min(displayH, newCH),
                );
                if (newCW > displayW) newCW = displayW;
            }

            // Keep centred
            const cx = cropX + cropW / 2;
            const cy = cropY + cropH / 2;
            let newX = Math.round(cx - newCW / 2);
            let newY = Math.round(cy - newCH / 2);
            newX = Math.max(0, Math.min(displayW - newCW, newX));
            newY = Math.max(0, Math.min(displayH - newCH, newY));

            setCropW(newCW);
            setCropH(newCH);
            setCropX(newX);
            setCropY(newY);
        },
        [cropX, cropY, cropW, cropH, displayW, displayH, locked, aspectRatio],
    );

    // ── Crop & export ──
    const handleCrop = useCallback(() => {
        if (!imgRef.current) return;

        // Convert crop box position from display-px back to natural-px
        const srcX = cropX / displayScale;
        const srcY = cropY / displayScale;
        const srcW = cropW / displayScale;
        const srcH = cropH / displayScale;

        // Output dimensions: maintain cropped region's aspect ratio
        const cropRatio = srcW / srcH;
        const outW = Math.min(outputWidth, Math.round(srcW));
        const outH = Math.round(outW / cropRatio);

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d")!;

        if (grayscale) {
            ctx.filter = "grayscale(100%)";
        }

        ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

        canvas.toBlob(
            (blob) => {
                if (blob) onCrop(blob);
            },
            "image/webp",
            0.9,
        );
    }, [
        cropX,
        cropY,
        cropW,
        cropH,
        displayScale,
        outputWidth,
        grayscale,
        onCrop,
    ]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onCancel]);

    const monoFont = "var(--font-geist-mono), monospace";

    // Clip-path to dim areas outside the crop box
    const clipDim =
        displayW > 0 && displayH > 0
            ? `polygon(evenodd, 0 0, ${displayW}px 0, ${displayW}px ${displayH}px, 0 ${displayH}px, 0 0, ${cropX}px ${cropY}px, ${cropX}px ${cropY + cropH}px, ${cropX + cropW}px ${cropY + cropH}px, ${cropX + cropW}px ${cropY}px, ${cropX}px ${cropY}px)`
            : undefined;

    // Corner handle positions + cursors
    const corners: {
        key: string;
        style: React.CSSProperties;
        cursor: string;
    }[] = [
        { key: "tl", style: { top: -4, left: -4 }, cursor: "nwse-resize" },
        { key: "tr", style: { top: -4, right: -4 }, cursor: "nesw-resize" },
        { key: "bl", style: { bottom: -4, left: -4 }, cursor: "nesw-resize" },
        { key: "br", style: { bottom: -4, right: -4 }, cursor: "nwse-resize" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5">
                {/* Instructions */}
                <p
                    className="text-xs tracking-[2px] uppercase text-white/50"
                    style={{ fontFamily: monoFont }}
                >
                    Drag to move · Drag corners to resize · Scroll to scale
                </p>

                {/* Image container */}
                <div
                    className="relative overflow-hidden rounded border border-white/20"
                    style={{
                        width: displayW || MAX_DISPLAY_W,
                        height: displayH || MAX_DISPLAY_H,
                        touchAction: "none",
                        background: "#111",
                    }}
                    onWheel={onWheel}
                >
                    {/* Full image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageSrc}
                        alt="Crop source"
                        draggable={false}
                        onLoad={handleImageLoad}
                        style={{
                            display: "block",
                            width: displayW || "auto",
                            height: displayH || "auto",
                            maxWidth: "none",
                            filter: grayscale ? "grayscale(100%)" : undefined,
                            userSelect: "none",
                            pointerEvents: "none",
                        }}
                    />

                    {/* Dimmed overlay outside the crop box */}
                    {displayW > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0, 0, 0, 0.55)",
                                clipPath: clipDim,
                                pointerEvents: "none",
                                transition: "clip-path 50ms ease-out",
                            }}
                        />
                    )}

                    {/* Draggable crop box outline */}
                    {displayW > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                left: cropX,
                                top: cropY,
                                width: cropW,
                                height: cropH,
                                border: "2px solid rgba(255, 255, 255, 0.7)",
                                borderRadius: 2,
                                cursor: "grab",
                                boxShadow:
                                    "0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.2)",
                            }}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                        >
                            {/* Corner drag handles */}
                            {corners.map(({ key, style, cursor }) => (
                                <div
                                    key={key}
                                    style={{
                                        position: "absolute",
                                        ...style,
                                        width: 10,
                                        height: 10,
                                        background: "rgba(255,255,255,0.9)",
                                        borderRadius: 1,
                                        cursor,
                                        touchAction: "none",
                                        zIndex: 10,
                                    }}
                                    onPointerDown={(e) =>
                                        onCornerPointerDown(key, e)
                                    }
                                    onPointerMove={onCornerPointerMove}
                                    onPointerUp={onCornerPointerUp}
                                    onPointerCancel={onCornerPointerUp}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Crop dimensions info */}
                {displayW > 0 && (
                    <p
                        className="text-[10px] tracking-[2px] text-white/30"
                        style={{ fontFamily: monoFont }}
                    >
                        {Math.round(cropW / displayScale)} ×{" "}
                        {Math.round(cropH / displayScale)} px
                    </p>
                )}

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
