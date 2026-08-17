export interface SynthesisRailState {
  conversations: boolean;
  blueprint: boolean;
}

export const SYNTHESIS_MESSAGE_SPACING_CLASS = "space-y-8";
/**
 * Surface for both side rails (conversations on the left, blueprint on the
 * right).
 *
 * Transparent on desktop: there the rails are flex siblings of the chat
 * column, so what sits behind them is the app background anyway — an opaque
 * fill only added a visible slab edge.
 *
 * Below `lg` the rails are absolutely-positioned overlays *on top of* the
 * conversation, so a fully transparent surface would put panel text over
 * message text. They keep a translucent scrim there, which the existing
 * `max-lg:backdrop-blur-2xl` on each rail frosts.
 */
export const SYNTHESIS_PANEL_SURFACE_CLASS = "bg-bg-app/60 lg:bg-transparent";

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
