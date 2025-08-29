// apps/client/src/App.jsx
import React, { useState } from 'react';
import AppShell from '@/components/AppShell.jsx';
import Router from '@/routes/Router.jsx';
import StrainEditor from '@/components/StrainEditor.jsx';

export default function App() {
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <>
      <AppShell onOpenEditor={() => setEditorOpen(true)}>
        <Router />
      </AppShell>
      <StrainEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
