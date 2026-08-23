import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ? ` «${this.props.label}»` : '';
    console.error(`[ОПОРА] Помилка розділу${label}:`, error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="panel" style={{ padding: 24, textAlign: 'center' }} role="alert">
        <AlertTriangle size={20} color="var(--danger)" />
        <div
          className="f-display"
          style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 4px' }}
        >
          Не вдалося завантажити розділ{this.props.label ? ` «${this.props.label}»` : ''}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 14 }}>
          Спробуйте ще раз — дані сценарію не постраждали.
        </div>
        <button onClick={this.reset} className="btn btn-surface" style={{ padding: '8px 16px' }}>
          Спробувати знову
        </button>
      </div>
    );
  }
}
