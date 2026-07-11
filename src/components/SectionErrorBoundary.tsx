import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "../lib/reportError";

interface Props {
  children: ReactNode;
  /** Short label for the fallback, e.g. "insights panel". */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Contains a render error to one region of the page. Without this, a single
 * dashboard card that throws bubbles to the root boundary and replaces the
 * WHOLE app with the error screen. Here the rest of the page keeps working and
 * only the failed section shows a compact, non-blocking message.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError(error, { boundary: this.props.label ?? "section" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass rounded-3xl p-6 border border-white/10 flex items-center gap-3 text-white/50">
          <AlertTriangle className="text-amber-400/70 shrink-0" size={18} />
          <span className="text-sm">
            This {this.props.label ?? "section"} couldn't load right now.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
