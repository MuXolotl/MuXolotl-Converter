import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-gradient-main flex items-center justify-center p-8">
          <div className="glass max-w-lg w-full p-8 text-center">
            <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
            
            <h1 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-white/60 mb-6">
              An unexpected error occurred. Your files are safe.
            </p>

            {this.state.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-left">
                <p className="text-red-400 font-mono text-sm break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="px-5 py-2 bg-gradient-primary rounded-lg text-white font-medium transition-shadow hover:shadow-lg"
              >
                Reload App
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