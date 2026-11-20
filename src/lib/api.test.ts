import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBase } from './api';

describe('resolveApiBase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the production backend instead of a localhost URL on a remote site', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveApiBase({
      hostname: 'nexsq.com',
      origin: 'https://nexsq.com',
      explicitBase: 'http://localhost:3001',
      mode: 'production',
    })).toBe('https://nsq-98et.onrender.com');
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('keeps localhost API settings for local development', () => {
    expect(resolveApiBase({
      hostname: 'localhost',
      origin: 'http://localhost:8080',
      explicitBase: 'http://localhost:3001',
      mode: 'production',
    })).toBe('');
  });

  it('uses a configured remote backend URL', () => {
    expect(resolveApiBase({
      hostname: 'nexsq.com',
      origin: 'https://nexsq.com',
      explicitBase: 'https://api.example.com',
      mode: 'production',
    })).toBe('https://api.example.com');
  });
});
