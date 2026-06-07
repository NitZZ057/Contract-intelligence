import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[error-boundary]", error, errorInfo);
  }

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">This page could not be rendered</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{this.state.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="focus-ring mt-6 inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reload page
        </button>
      </div>
    );
  }
}
