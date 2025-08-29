import React from 'react';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import ConnectionBanner from './ConnectionBanner.jsx';

/**
 * Application shell layout with header, sidebar and content.
 * @param {{children: React.ReactNode}} props
 */
export default function AppShell({ children, onOpenEditor }) {
  return (
    <div className="app-shell">
      <ConnectionBanner />
      <Header onOpenEditor={onOpenEditor} />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
