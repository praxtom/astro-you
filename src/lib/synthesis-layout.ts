export interface SynthesisRailState {
  conversations: boolean;
  blueprint: boolean;
}

export const SYNTHESIS_MESSAGE_SPACING_CLASS = "space-y-8";
export const SYNTHESIS_PANEL_SURFACE_CLASS = "bg-bg-app";

/** Default rail state whenever the layout crosses the desktop breakpoint. */
export function getDefaultSynthesisRails(
  isDesktop: boolean,
  isSignedIn: boolean,
): SynthesisRailState {
  if (!isDesktop) {
    return { conversations: false, blueprint: false };
  }

  return { conversations: isSignedIn, blueprint: true };
}
