import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full bg-gray-50 text-gray-900 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              Please refresh the page. Your draft is saved locally on this device.
            </p>
            <button
              type="button"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
            {this.state.error?.message ? (
              <pre className="mt-4 text-xs text-gray-500 whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

