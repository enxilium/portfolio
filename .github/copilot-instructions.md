# Copilot Instructions — Portfolio Website

## Project Overview

This is a **personal portfolio website** for a software engineer who also pursues creative disciplines: **writing, music production, and 3D modeling**. The site targets **recruiters and collaborators**, so it must feel polished, performant, and visually distinctive. The 3D scene is the centerpiece — it serves as both navigation and first impression.

## Tech Stack

| Layer             | Technology                                       | Version                          |
| ----------------- | ------------------------------------------------ | -------------------------------- |
| Framework         | Next.js (App Router)                             | 16.x                             |
| UI Library        | React                                            | 19.x                             |
| Language          | TypeScript (strict)                              | 5.x                              |
| Styling           | Tailwind CSS v4                                  | 4.x (via `@tailwindcss/postcss`) |
| 3D Engine         | Three.js                                         | 0.183.x                          |
| 3D React Bindings | @react-three/fiber                               | 9.x                              |
| 3D Helpers        | @react-three/drei                                | 10.x                             |
| Fonts             | Geist Sans & Geist Mono (via `next/font/google`) | —                                |
| Linting           | ESLint 9 with `eslint-config-next`               | —                                |
| Assets            | Git LFS for `.glb` files                         | —                                |

## Architecture & Conventions

### Directory Structure

```
app/                    # Next.js App Router — all routes and components
  layout.tsx            # Root layout (server component) — fonts, metadata, global CSS
  page.tsx              # Home page (client component) — renders the 3D Canvas
  globals.css           # Tailwind v4 import + CSS custom properties
  CameraController.tsx  # Camera logic: Blender camera import, mouse-follow pan, scroll zoom
  PillarAnimation.tsx   # Interactive pillar hover/rise animations via raycasting
public/
  scene.glb             # Blender-exported 3D scene (tracked via Git LFS)
```

### Key Patterns

- **`"use client"` directive**: Required on any component that uses React hooks, Three.js, or browser APIs. The root `layout.tsx` remains a server component; the `page.tsx` and all 3D components are client components.
- **GLB scene as single source of truth**: The entire 3D environment is authored in Blender and exported as a single `.glb` file. Cameras, object names, and transforms are defined in Blender and referenced by name in code (e.g., `scene.getObjectByName("Pillar_Right")`).
- **Ref-heavy animation**: Animation state lives in `useRef` (not `useState`) to avoid re-renders on every frame. `useFrame` from R3F drives the render loop.
- **Dev-only tooling**: Free-view camera mode (OrbitControls) is gated behind `process.env.NODE_ENV === "development"` and toggled with the `F` key.
- **No external state management**: State is local (hooks). No Redux, Zustand, or context providers yet.

### Component Guidelines

- **One component per file**. File name matches the default export: `CameraController.tsx` → `export default function CameraController`.
- **Props interfaces** are defined inline in the same file, directly above the component, using the `interface` keyword (not `type`).
- **Three.js objects** should be accessed from the loaded scene by name, not created imperatively in React — this keeps the visual authoring in Blender.
- **`useFrame` callbacks** must never allocate objects (vectors, quaternions, etc.) inside the loop. Allocate in `useRef` or `useEffect`, then reuse.
- Keep R3F components **render-null** when they only contribute logic (see `PillarAnimation` returning `null`).

### Styling

- Tailwind CSS v4 with the `@tailwindcss/postcss` plugin — **no `tailwind.config.js`**; configuration is done via CSS `@theme` blocks in `globals.css`.
- CSS custom properties (`--background`, `--foreground`) drive light/dark theming via `prefers-color-scheme`.
- Use Tailwind utility classes for layout and spacing. Avoid inline `style` props unless required for dynamic 3D-related values.
- Prefer the `--font-sans` / `--font-mono` CSS variables (mapped to Geist) over hardcoded font-family values.

### TypeScript

- `strict: true` — no implicit `any`, no unchecked index access.
- Use `THREE.PerspectiveCamera`, `THREE.Object3D`, etc. type narrowing with `instanceof` before accessing subclass properties.
- Import Three.js types from `three` directly (`import * as THREE from "three"`).
- R3F hook types: `useThree`, `useFrame` — use the callback selector form of `useThree` for performance when only one property is needed: `useThree((state) => state.camera)`.

## 3D Scene Conventions

### Blender → Code Contract

| Blender Object Name             | Code Reference     | Purpose                                           |
| ------------------------------- | ------------------ | ------------------------------------------------- |
| First camera in `cameras` array | `CameraController` | Defines initial viewport: position, rotation, FOV |
| `Pillar_Right`                  | `PillarAnimation`  | Right interactive pillar                          |
| `Pillar_Left`                   | `PillarAnimation`  | Left interactive pillar                           |

When adding new interactive objects:

1. Name them clearly in Blender (PascalCase, descriptive).
2. Export the updated `.glb`.
3. Create a new component that receives `scene: THREE.Group`, looks up the object by name, and drives animation in `useFrame`.

### Camera System

- **Base state** is captured from the Blender camera on mount (position, quaternion, FOV).
- **Mouse-follow pan**: Subtle rotation offset proportional to cursor position. Scales with zoom level.
- **Scroll zoom**: Adjusts FOV between `baseFOV` and `baseFOV * 0.6`. Does **not** move the camera position.
- **Free view** (dev only): Enables `OrbitControls` for debugging. Press `F` to toggle.
- All camera interpolation uses `slerp` / `lerp` with a factor of `0.05` for smoothness.

### Interaction Model

- Hover detection uses `THREE.Raycaster` against specific mesh arrays (not the whole scene).
- Hover state is stored in `useRef<boolean>` — not React state — to avoid re-renders.
- Animations are physics-less lerps in `useFrame`.

## Content Sections (Planned)

The portfolio will eventually showcase multiple facets:

| Section                  | Content Type                                          | Notes                              |
| ------------------------ | ----------------------------------------------------- | ---------------------------------- |
| **Software Engineering** | Projects, open-source work, tech stack                | Primary section for recruiters     |
| **Writing**              | Blog posts, essays, creative writing                  | Could use MDX or a headless CMS    |
| **Music Production**     | Tracks, embeds (SoundCloud/Bandcamp), DAW screenshots | Audio playback integration         |
| **3D Modeling**          | Renders, turntables, Blender projects                 | Could embed interactive 3D viewers |
| **About / Contact**      | Bio, links, resume download                           | Keep concise and professional      |

When implementing new sections:

- Each major section should be its own route under `app/` (e.g., `app/writing/page.tsx`).
- Shared layout elements (nav, footer) go in `app/layout.tsx` or a shared layout component.
- The 3D scene on the home page may serve as a hub/navigation — pillar interactions or other scene elements could link to sections.

## Performance Considerations

- **GLB optimization pipeline**: The scene GLB is compressed via `@gltf-transform/cli` (dedup → simplify → Draco). Run `npm run optimize-glb` after every Blender re-export. The Draco decoder is loaded from Google's CDN via `useGLTF.setDecoderPath()`.
- **Canvas settings**: `dpr` is capped at `[1, 1.5]` to reduce fill-rate on integrated GPUs. `frameloop="demand"` means frames are only rendered when `state.invalidate()` is called — all `useFrame` callbacks and input event handlers must call `invalidate()`.
- **Zero-allocation render loop**: `useFrame` callbacks must never allocate objects (vectors, quaternions, etc.). Pre-allocate in `useRef` and reuse via `.copy()`, `.set()`, `.addScaledVector()`.
- **`useFrame` budget**: All per-frame logic shares one requestAnimationFrame loop. Keep calculations minimal; avoid allocations.
- **Code splitting**: Three.js is heavy (~600KB). The `"use client"` boundary on `page.tsx` ensures the 3D code is only loaded client-side. Consider `next/dynamic` with `ssr: false` if needed for additional 3D routes.
- **Font loading**: Geist is loaded via `next/font/google` with CSS variable strategy — no FOUT.

## Git & Assets

- `.glb` files are tracked with **Git LFS** (see `.gitattributes`).
- Never commit node_modules, `.next/`, or env files (see `.gitignore`).
- When adding new large binary assets (textures, audio files, video), add their patterns to `.gitattributes` for LFS tracking.

## Development Workflow

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # Run ESLint
npm run optimize-glb # Optimize public/scene.glb (dedup + simplify + Draco)
```

- The dev server uses Turbopack by default (Next.js 16).
- Press `F` in the browser during dev to toggle free-view camera for scene debugging.
- After modifying the Blender scene, re-export to `public/scene.glb`, run `npm run optimize-glb`, then hard-refresh the browser.

## Code Style

- **Indentation**: 4 spaces (as established in existing files).
- **Quotes**: Double quotes for strings.
- **Semicolons**: Yes, always.
- **Trailing commas**: Yes, in multi-line constructs.
- **Imports**: Group by: (1) React/Next.js, (2) third-party, (3) local. No blank lines between groups unless clarity demands it.
- **Constants**: `UPPER_SNAKE_CASE` for module-level numeric/config constants. Defined at the top of the file, below imports, with a comment explaining their purpose.
- **Naming**: PascalCase for components and interfaces. camelCase for variables, functions, and refs.
