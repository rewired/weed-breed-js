import React, { useState } from 'react';

const periods = ['24h', '7d', '1m'] as const;

type Period = typeof periods[number];

const CompanyView: React.FC = () => {
  const [period, setPeriod] = useState<Period>('24h');
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Company View</h2>
      <div style={{ marginBottom: '1rem' }}>
        {periods.map(p => (
          <button key={p} onClick={() => setPeriod(p)} disabled={period === p} style={{ marginRight: 4 }}>
            {p}
          </button>
        ))}
      </div>
      {/* TODO: Charts and tables for consumption & costs */}
    </div>
  );
};

export default CompanyView;
