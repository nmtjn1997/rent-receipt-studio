/** `crypto.randomUUID` only exists in secure contexts; plain http on a LAN address needs the fallback. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
