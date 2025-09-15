import React from 'react';
import { useSimState } from '@/store/simStore';

/**
 * Fixed footer showing current cash and daily operating costs.
 */
export default function FooterMiniFinance() {
  const { cash, dailyCosts } = useSimState();
  const fmt = (v: number) => `฿ ${Math.round(v).toLocaleString()}`;
  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/70 text-white text-sm p-2 flex justify-center space-x-4">
      <span>Cash: {fmt(cash)}</span>
      <span>Daily Costs: {fmt(dailyCosts)}</span>
    </div>
  );
}
