export interface SynthesisRailState {
  conversations: boolean;
  blueprint: boolean;
}

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
