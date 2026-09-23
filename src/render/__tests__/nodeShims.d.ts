// Minimal types for the few Node APIs that runtimeAssets.test.ts uses. The
// project deliberately has no @types/node dependency (the game runs in the
// browser); vitest itself runs on Node, so these calls work at test time.
declare module "node:crypto" {
  export function createHash(algorithm: string): { update(data: Uint8Array): { digest(encoding: "hex"): string } };
}
declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: "utf8"): string;
}
declare module "node:path" {
  export function resolve(...segments: string[]): string;
}
declare const process: { cwd(): string };
