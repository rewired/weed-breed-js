// apps/client/src/App.jsx
import React from 'react';
import AppShell from '@/components/AppShell.jsx';
import Router from '@/routes/Router.jsx';
import DevConsole from '@/components/DevConsole.jsx';
import DevBadge from '@/components/DevBadge.jsx';
import DevErrorBoundary from '@/components/DevErrorBoundary.jsx';
import FooterMiniFinance from '@/components/FooterMiniFinance.tsx';

export default function App() {
  return (
    <DevErrorBoundary>
      <AppShell>
        <Router />
      </AppShell>
      <FooterMiniFinance />
      <DevConsole />
      <DevBadge />
    </DevErrorBoundary>
  );
}
