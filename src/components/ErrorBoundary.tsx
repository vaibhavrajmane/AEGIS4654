import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: '',
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      hasError: true,
      errorMessage: err.message || 'Unknown Simulation Engine Error',
      errorStack: err.stack || '',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('AEGIS Simulation Engine Error:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#040d1a] text-cyan-100 flex items-center justify-center p-6 font-mono">
          <div className="max-w-xl w-full bg-[#09192f] border border-red-500/60 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 font-bold text-lg mb-2">
              <span>⚠ AEGIS SIMULATION ENGINE FAULT</span>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              The underwater rendering loop encountered an unexpected runtime error:
            </p>
            <div className="bg-black/60 border border-red-500/30 rounded p-3 text-xs text-red-300 overflow-x-auto mb-4">
              <div className="font-semibold mb-1">{this.state.errorMessage}</div>
              {this.state.errorStack && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap mt-2">
                  {this.state.errorStack}
                </pre>
              )}
            </div>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '', errorStack: '' })}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors cursor-pointer"
            >
              Reset Simulation Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
