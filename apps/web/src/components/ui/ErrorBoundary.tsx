'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // Satisfy React 19 refs requirement
  refs: Record<string, never> = {};

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex items-center justify-center h-screen"
          style={{ background: 'var(--color-bg-primary)' }}
        >
          <div
            className="glass-heavy max-w-md w-full mx-4 p-8 rounded-2xl text-center"
            style={{
              border: '1px solid rgba(239, 68, 68, 0.2)',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.05)',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Something went wrong
            </h2>
            <p
              className="text-sm mb-6 leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.handleRetry}
              className="glow-hover btn-ripple px-6 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent-primary)',
                border: '1px solid rgba(212,149,107,0.2)',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
