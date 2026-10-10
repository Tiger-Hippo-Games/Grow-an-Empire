/**
 * Testing switches in the URL (`?reset`, `?platform=mock`, `?perf`) work only
 * in development and on this machine (`pnpm preview`, the QA scripts, the
 * iframe simulator), never on the portal. Portals can pass their own query
 * string through to the game frame, and `?reset` would discard a player's run.
 */
/**
 * A machine-local host: a single-label name (the dev machine's own name or the
 * loopback name), a 127.x loopback address, or IPv6 loopback. The portal always
 * serves from a fully qualified domain, so none of these match it. (Written as
 * patterns, not literal host names, so the built bundle carries no local URLs,
 * which the portal's checks reject.)
 */
export function isLocalHost(hostname: string): boolean {
  return hostname.length > 0 && (!hostname.includes(".") || /^127\./.test(hostname) || hostname === "[::1]" || hostname === "::1");
}

export function debugFlagsAllowed(hostname: string = typeof window === "undefined" ? "" : window.location.hostname, dev: boolean = import.meta.env.DEV): boolean {
  return dev || isLocalHost(hostname);
}

/** True when the URL has testing switch `name` and testing switches are allowed here. */
export function hasDebugFlag(name: string, search: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  return debugFlagsAllowed() && new URLSearchParams(search).has(name);
}
