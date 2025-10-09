import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 Error Boundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-gradient-main flex items-center justify-center p-8">
          <div className="glass max-w-2xl w-full p-8 text-center">
            <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
            
            <h1 className="text-3xl font-bold text-white mb-4">Oops! Something went wrong</h1>
            
            <p className="text-white/70 mb-6">
              The application encountered an unexpected error. Don't worry, your files are safe!
            </p>

            {this.state.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-left">
                <p className="text-red-400 font-mono text-sm mb-2">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <details className="text-white/50 text-xs">
                    <summary className="cursor-pointer hover:text-white/70 transition-colors">
                      Stack trace
                    </summary>
                    <pre className="mt-2 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="glass px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all font-semibold text-white flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-gradient-primary rounded-lg transition-all font-semibold text-white hover:shadow-lg"
              >
                Reload Application
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