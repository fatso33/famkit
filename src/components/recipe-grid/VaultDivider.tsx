import React from 'react';
import { VaultTabLabel, type VaultTab } from './VaultTabLabel';

interface VaultDividerProps {
  tab: VaultTab;
  /** A heading under the page's own (the Recipe Box), or under a deck's (h3). */
  heading?: 'h2' | 'h3';
  /** Added to the divider, and its style: its place in an entrance or a deal. */
  className?: string;
  style?: React.CSSProperties;
  /** The tab's own style: the scroll timeline its pinned twin follows. */
  tabStyle?: React.CSSProperties;
}

/**
 * A divider tab filed in the Recipe Box in front of its group's cards: the category or cook, and
 * how many, over the edge the cards are filed behind.
 */
export const VaultDivider: React.FC<VaultDividerProps> = ({
  tab,
  heading: Heading = 'h2',
  className,
  style,
  tabStyle,
}) => (
  <div className={className ? `vault-divider ${className}` : 'vault-divider'} style={style}>
    <Heading className="vault-tab" style={tabStyle}>
      <VaultTabLabel tab={tab} />
    </Heading>
    <div className="vault-tab-edge" aria-hidden="true" />
  </div>
);
