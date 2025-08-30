import React from 'react';

/** Small fixed badge for development mode. */
export default function DevBadge() {
  if (!import.meta.env.DEV) return null;
  return (
    <span
      style={{
        position: 'fixed',
        top: 4,
        right: 4,
        padding: '2px 4px',
        fontSize: 10,
        background: '#000',
        color: '#fff',
        borderRadius: 2,
        opacity: 0.6,
        zIndex: 1000,
      }}
    >
      DEV
    </span>
  );
}
