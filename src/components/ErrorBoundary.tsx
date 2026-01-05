import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error monitoring service (Sentry, etc.)
    console.error("Error caught by boundary:", error, errorInfo);

    // In production, you would send this to your error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030308] flex items-center justify-center p-6">
          {/* Background Ambiance */}
          <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-red-900/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-violet/5 blur-[120px] rounded-full"></div>
          </div>

          <div className="w-full max-w-lg glass p-12 relative z-10 border border-white/10 rounded-3xl text-center">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="text-red-400" size={36} />
            </div>

            {/* Message */}
            <h1 className="text-title text-3xl mb-4 font-display">
              Cosmic Disruption
            </h1>
            <p className="text-body text-sm opacity-70 mb-8 leading-relaxed">
              The stars have encountered an unexpected alignment. This error has
              been recorded and our engineers are investigating.
            </p>

            {/* Error Details (Dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 mb-8 text-left">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={this.handleRefresh}
                className="btn btn-primary py-3 px-8 flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn btn-outline py-3 px-8 flex items-center justify-center gap-2"
              >
                <Home size={16} />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
