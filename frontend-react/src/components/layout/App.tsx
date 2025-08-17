import React from 'react';
import LeftPanel from './LeftPanel';
import TopBar from './TopBar';
import MainContent from './MainContent';

const App: React.FC = () => (
  <div style={{ display: 'flex', height: '100vh' }}>
    <LeftPanel />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <MainContent />
    </div>
  </div>
);

export default App;
