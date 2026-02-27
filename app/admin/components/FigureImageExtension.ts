import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ImageNodeView from "./ImageNodeView";

// Helper: resolve the <img> element whether the matched DOM node is <figure> or <img>
function getImgEl(el: HTMLElement): HTMLElement | null {
    return el.tagName === "FIGURE" ? el.querySelector("img") : el;
}

/**
 * Extended Image node with caption and width support.
 *
 * Renders as:
 *   <figure class="image-figure"><img .../><figcaption>…</figcaption></figure>
 * when a caption is present, or plain <img .../> otherwise.
 *
 * Uses a React NodeView for interactive editing — right-click context menu
 * with caption editing, resize, crop, and delete.
 */
const FigureImage = Image.extend({
    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (el: HTMLElement) =>
                    getImgEl(el)?.getAttribute("src") || null,
            },
            alt: {
                default: null,
                parseHTML: (el: HTMLElement) =>
                    getImgEl(el)?.getAttribute("alt") || null,
            },
            title: {
                default: null,
                parseHTML: (el: HTMLElement) =>
                    getImgEl(el)?.getAttribute("title") || null,
            },
            caption: {
                default: null,
                parseHTML: (el: HTMLElement) =>
                    el.tagName === "FIGURE"
                        ? el.querySelector("figcaption")?.textContent || null
                        : null,
                // Caption is rendered via node-level renderHTML, not as an HTML attribute
                renderHTML: () => ({}),
            },
            width: {
                default: null,
                parseHTML: (el: HTMLElement) => {
                    const w = getImgEl(el)?.getAttribute("width");
                    return w ? parseInt(w) : null;
                },
                renderHTML: (attrs: Record<string, unknown>) => {
                    if (!attrs.width) return {};
                    return { width: String(attrs.width) };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: "figure",
                getAttrs: (dom) => {
                    const el = dom as HTMLElement;
                    return el.querySelector("img") ? {} : false;
                },
            },
            {
                tag: "img[src]",
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const caption = node.attrs.caption as string | null;
        if (caption) {
            return [
                "figure",
                { class: "image-figure" },
                ["img", HTMLAttributes],
                ["figcaption", {}, caption],
            ];
        }
        return ["img", HTMLAttributes];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
    },
});

export default FigureImage;
