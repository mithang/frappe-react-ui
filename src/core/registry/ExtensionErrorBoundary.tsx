// Wraps any extension-supplied component (a swapped Form, a widget, slot content) so it degrades
// to a visible warning instead of taking the whole page down. Pair with installExtension()'s
// setup()-time isolation — that catches setup-time throws, this catches render-time throws.

import React from 'react';

interface Props {
  extensionName: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ExtensionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ExtensionHost] "${this.props.extensionName}" threw while rendering:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="p-3 text-sm border border-destructive/40 bg-destructive/10 text-destructive rounded-md">
          Extension "{this.props.extensionName}" failed to render and was disabled for this session.
        </div>
      );
    }
    return this.props.children;
  }
}
