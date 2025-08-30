// apps/client/src/App.jsx
import React, { useState } from 'react';
import AppShell from '@/components/AppShell.jsx';
import Router from '@/routes/Router.jsx';
import StrainEditor from '@/components/StrainEditor.jsx';
import DevConsole from '@/components/DevConsole.jsx';
import DevBadge from '@/components/DevBadge.jsx';
import DevErrorBoundary from '@/components/DevErrorBoundary.jsx';

export default function App() {
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <DevErrorBoundary>
      <AppShell onOpenEditor={() => setEditorOpen(true)}>
        <Router />
      </AppShell>
      <StrainEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
      <DevConsole />
      <DevBadge />
    </DevErrorBoundary>
  );
}
