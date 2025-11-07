// Minimal ambient declarations to satisfy the TypeScript language server
// in editors when devDependencies (vitest) are not installed.
// This file is intentionally small — install the real dependencies to get full types.

declare module 'vitest' {
  export const describe: any;
  export const it: any;
  export const test: any;
  export const expect: any;
  export const vi: any;
  export function beforeEach(fn: any): any;
  export function afterEach(fn: any): any;
  export function beforeAll(fn: any): any;
  export function afterAll(fn: any): any;
}

declare module 'vitest/config' {
  export function defineConfig(cfg: any): any;
  export default defineConfig;
}

// Common globals provided by test runners
declare const describe: any;
declare const it: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const vi: any;
