import { Component, ReactNode } from "react";
import { reportError } from "../lib/reportError";
import { StatusNotice } from "./ui/StatusNotice";

interface Props {
  children: ReactNode;
  /** Short label for error reports, e.g. "insights panel". Not shown to users. */
  label?: string;
  /**
   * Classes for the fallback card. When the boundary is a direct child of a
   * grid, pass the tile's span classes (e.g. "sm:col-span-2 lg:col-span-4")
   * so a failed tile keeps its place instead of collapsing to one column.
   */
  className?: string;
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

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <StatusNotice
          size="section"
          message="This part of the page didn't load. Try again, or refresh the page if it keeps happening."
          onRetry={this.reset}
          className={`min-w-0 ${this.props.className ?? ""}`.trim()}
        />
      );
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
