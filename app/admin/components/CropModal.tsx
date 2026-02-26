"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

// Maximum display area for the full image
const MAX_DISPLAY_W = 600;
const MAX_DISPLAY_H = 500;

export default function CropModal({
    imageSrc,
    aspectRatio,
    outputWidth,
    grayscale = false,
    onCrop,
    onCancel,
}: CropModalProps) {
    const imgRef = useRef<HTMLImageElement | null>(null);

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

    // Crop box dimensions in display-px (computed from aspect ratio)
    const [cropW, setCropW] = useState(0);
    const [cropH, setCropH] = useState(0);

    // Drag state
    const dragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const cropStart = useRef({ x: 0, y: 0 });

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

            // Compute the largest crop box that fits within the displayed image
            // while maintaining the target aspect ratio
            let cw: number;
            let ch: number;
            if (dw / dh > aspectRatio) {
                // Image is wider than target — height is the constraint
                ch = dh;
                cw = Math.round(ch * aspectRatio);
            } else {
                // Image is taller than target — width is the constraint
                cw = dw;
                ch = Math.round(cw / aspectRatio);
            }

            setCropW(cw);
            setCropH(ch);

            // Centre the crop box
            setCropX(Math.round((dw - cw) / 2));
            setCropY(Math.round((dh - ch) / 2));
        },
        [aspectRatio],
    );

    // ── Drag the crop box ──
    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
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

            const newX = Math.min(
                displayW - cropW,
                Math.max(0, cropStart.current.x + dx),
            );
            const newY = Math.min(
                displayH - cropH,
                Math.max(0, cropStart.current.y + dy),
            );

            setCropX(newX);
            setCropY(newY);
        },
        [displayW, displayH, cropW, cropH],
    );

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    // ── Scroll to resize crop box ──
    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();

            const zoomFactor = e.deltaY < 0 ? 1.06 : 1 / 1.06;

            // Compute new crop width, clamped to image bounds
            const minCW = Math.min(80, displayW);
            const maxCW = displayW;
            let newCW = Math.round(cropW * zoomFactor);
            newCW = Math.max(minCW, Math.min(maxCW, newCW));

            let newCH = Math.round(newCW / aspectRatio);
            // Clamp by height too
            if (newCH > displayH) {
                newCH = displayH;
                newCW = Math.round(newCH * aspectRatio);
            }

            // Keep the crop box centred on its current centre
            const cx = cropX + cropW / 2;
            const cy = cropY + cropH / 2;
            let newX = Math.round(cx - newCW / 2);
            let newY = Math.round(cy - newCH / 2);

            // Clamp position
            newX = Math.max(0, Math.min(displayW - newCW, newX));
            newY = Math.max(0, Math.min(displayH - newCH, newY));

            setCropW(newCW);
            setCropH(newCH);
            setCropX(newX);
            setCropY(newY);
        },
        [cropX, cropY, cropW, cropH, displayW, displayH, aspectRatio],
    );

    // ── Crop & export ──
    const handleCrop = useCallback(() => {
        if (!imgRef.current) return;

        const outputHeight = Math.round(outputWidth / aspectRatio);
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext("2d")!;

        // Convert crop box position from display-px back to natural-px
        const srcX = cropX / displayScale;
        const srcY = cropY / displayScale;
        const srcW = cropW / displayScale;
        const srcH = cropH / displayScale;

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
        cropX,
        cropY,
        cropW,
        cropH,
        displayScale,
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

    // Clip-path to dim areas outside the crop box (the "letterbox" effect).
    // We use a polygon with a hole (outer rect CW, inner rect CCW).
    const clipDim =
        displayW > 0 && displayH > 0
            ? `polygon(evenodd, 0 0, ${displayW}px 0, ${displayW}px ${displayH}px, 0 ${displayH}px, 0 0, ${cropX}px ${cropY}px, ${cropX}px ${cropY + cropH}px, ${cropX + cropW}px ${cropY + cropH}px, ${cropX + cropW}px ${cropY}px, ${cropX}px ${cropY}px)`
            : undefined;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5">
                {/* Instructions */}
                <p
                    className="text-xs tracking-[2px] uppercase text-white/50"
                    style={{ fontFamily: monoFont }}
                >
                    Drag the crop box · Scroll to resize
                </p>

                {/* Image container — shows the full image */}
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
                            {/* Corner indicators */}
                            {[
                                { top: -3, left: -3 },
                                { top: -3, right: -3 },
                                { bottom: -3, left: -3 },
                                { bottom: -3, right: -3 },
                            ].map((pos, i) => (
                                <div
                                    key={i}
                                    style={{
                                        position: "absolute",
                                        ...pos,
                                        width: 8,
                                        height: 8,
                                        background: "rgba(255,255,255,0.9)",
                                        borderRadius: 1,
                                        pointerEvents: "none",
                                    }}
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
