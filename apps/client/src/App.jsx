// apps/client/src/App.jsx
import React from 'react';
import AppShell from '@/components/AppShell.jsx';
import Router from '@/routes/Router.jsx';
import DevConsole from '@/components/DevConsole.jsx';
import DevBadge from '@/components/DevBadge.jsx';
import DevErrorBoundary from '@/components/DevErrorBoundary.jsx';

export default function App() {
  return (
    <DevErrorBoundary>
      <AppShell>
        <Router />
      </AppShell>
      <DevConsole />
      <DevBadge />
    </DevErrorBoundary>
  );
}
