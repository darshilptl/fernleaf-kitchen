'use client';

import { useState } from 'react';
import { PriceGrid } from './price-grid';
import { RuleEditor } from './rule-editor';
import { TierList } from './tier-list';

/**
 * Pricing workspace: tier list on top, rule editor and price
 * grid for the selected tier below. Tier selection is local UI
 * state; all values come from the server.
 */
export function PricingWorkspace(): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <TierList selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId !== null && (
        <div className="flex min-w-0 flex-col gap-8">
          <div className="rounded-lg bg-background-panel p-6 shadow-card">
            <h2 className="heading-sm mb-4">Derivation rule</h2>
            <RuleEditor tierId={selectedId} />
          </div>
          <PriceGrid tierId={selectedId} />
        </div>
      )}
    </div>
  );
}
