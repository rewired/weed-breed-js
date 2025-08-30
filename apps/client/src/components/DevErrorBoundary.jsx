import React from 'react';

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[DevErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ background: '#c00', color: '#fff', padding: 8, whiteSpace: 'pre-wrap' }}>
          {String(this.state.error)}
        </pre>
      );
    }
    return this.props.children;
  }
}

/** Error boundary used only in development to avoid blank screens. */
export default function DevErrorBoundary({ children }) {
  return import.meta.env.DEV ? <Boundary>{children}</Boundary> : <>{children}</>;
}
