import React from 'react';

/**
 * Small card to display a KPI.
 * @param {{label:string,value:React.ReactNode}} props
 */
export default function KPICard({ label, value }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
