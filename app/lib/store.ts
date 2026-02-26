import { create } from "zustand";

interface SettingsState {
    // Rock animation controls
    driftSpeed: number;
    repelStrength: number;
    // Day/night mode
    isNight: boolean;
    // Rain toggle
    isRaining: boolean;
    // Free-view camera mode
    freeView: boolean;
    // Whether the user is actively dragging in free-view (OrbitControls)
    isDragging: boolean;
    // Stargate activation progress (0 = idle, 1 = climax)
    activationProgress: number;
    // Whether the intro boot sequence is complete
    introComplete: boolean;
    // Whether we've transitioned through the stargate
    sceneTransitioned: boolean;
    // Whether the 3D scene (GLB) has finished loading
    sceneReady: boolean;
    // Whether the bunker doors have started opening
    bunkerOpen: boolean;
    // Whether audio is muted (persisted to localStorage)
    audioMuted: boolean;
    // Which pillar is currently hovered (null = none)
    hoveredPillar: "left" | "right" | "back" | null;
    // Which pillar the camera is focused on (null = default view)
    focusedPillar: "left" | "right" | null;
    // Whether the acknowledgments modal is open
    acknowledgmentsOpen: boolean;
    // Actions
    setDriftSpeed: (speed: number) => void;
    setRepelStrength: (strength: number) => void;
    toggleNight: () => void;
    toggleRain: () => void;
    setFreeView: (v: boolean) => void;
    setIsDragging: (v: boolean) => void;
    setActivationProgress: (v: number) => void;
    setIntroComplete: (v: boolean) => void;
    setSceneTransitioned: (v: boolean) => void;
    setSceneReady: (v: boolean) => void;
    setBunkerOpen: (v: boolean) => void;
    toggleAudioMuted: () => void;
    setHoveredPillar: (v: "left" | "right" | "back" | null) => void;
    setFocusedPillar: (v: "left" | "right" | null) => void;
    setAcknowledgmentsOpen: (v: boolean) => void;
}

const useStore = create<SettingsState>((set) => ({
    driftSpeed: 0.4,
    repelStrength: 1,
    isNight: false,
    isRaining: false,
    freeView: false,
    isDragging: false,
    activationProgress: 0,
    introComplete: false,
    sceneTransitioned: false,
    sceneReady: false,
    bunkerOpen: false,
    audioMuted:
        typeof window !== "undefined"
            ? localStorage.getItem("audioMuted") !== "false"
            : true,
    hoveredPillar: null,
    focusedPillar: null,
    acknowledgmentsOpen: false,
    setDriftSpeed: (speed) => set({ driftSpeed: speed }),
    setRepelStrength: (strength) => set({ repelStrength: strength }),
    toggleNight: () => set((s) => ({ isNight: !s.isNight })),
    toggleRain: () => set((s) => ({ isRaining: !s.isRaining })),
    setFreeView: (v) => set({ freeView: v }),
    setIsDragging: (v) => set({ isDragging: v }),
    setActivationProgress: (v) => set({ activationProgress: v }),
    setIntroComplete: (v) => set({ introComplete: v }),
    setSceneTransitioned: (v) => set({ sceneTransitioned: v }),
    setSceneReady: (v) => set({ sceneReady: v }),
    setBunkerOpen: (v) => set({ bunkerOpen: v }),
    toggleAudioMuted: () =>
        set((s) => {
            const next = !s.audioMuted;
            localStorage.setItem("audioMuted", String(next));
            return { audioMuted: next };
        }),
    setHoveredPillar: (v) => set({ hoveredPillar: v }),
    setFocusedPillar: (v) => set({ focusedPillar: v }),
    setAcknowledgmentsOpen: (v) => set({ acknowledgmentsOpen: v }),
}));

export default useStore;
