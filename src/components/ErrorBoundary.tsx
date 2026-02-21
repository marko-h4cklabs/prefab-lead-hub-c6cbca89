import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDiagnostics = () => {
    const { error, errorInfo } = this.state;
    const diagnostics = [
      `Route: ${window.location.pathname}${window.location.search}${window.location.hash}`,
      `Error: ${error?.message || "Unknown error"}`,
      `Stack: ${error?.stack || "N/A"}`,
      `Component stack: ${errorInfo?.componentStack || "N/A"}`,
    ].join("\n\n");
    navigator.clipboard.writeText(diagnostics).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-md w-full space-y-6 text-center">
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. You can reload the page or copy diagnostic info for support.
            </p>
            <p className="text-xs font-mono text-destructive break-all">
              {this.state.error?.message || "Unknown error"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-sm font-medium rounded-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Reload
              </button>
              <button
                onClick={this.handleCopyDiagnostics}
                className="px-4 py-2 text-sm font-medium rounded-sm border border-border text-foreground hover:bg-muted transition-colors"
              >
                Copy diagnostics
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
