import React, { useEffect, useState } from 'react';

/** Navigation sidebar. */
export default function Sidebar() {
  const [hash, setHash] = useState(location.hash || '#/structure');
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/structure');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const links = [
    ['#/structure', 'Structure'],
    ['#/devices', 'Devices'],
    ['#/plants', 'Plants'],
  ];

  return (
    <nav>
      {links.map(([href, label]) => (
        <a key={href} href={href} className={hash.startsWith(href) ? 'active' : ''}>
          {label}
        </a>
      ))}
    </nav>
  );
}
