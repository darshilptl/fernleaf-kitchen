'use client';

/**
 * Cross-tab session sync. Login/logout in one tab broadcasts so
 * sibling tabs refetch instead of sitting on a stale cache.
 * No-ops outside the browser or without BroadcastChannel.
 */
const CHANNEL_NAME = 'fernleaf:session';

export function broadcastSessionChanged(): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return;
  }
  new BroadcastChannel(CHANNEL_NAME).postMessage({ type: 'session-changed' });
}

export function subscribeSessionChanged(onChange: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = () => onChange();
  return () => channel.close();
}
