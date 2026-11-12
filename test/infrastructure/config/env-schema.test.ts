import { describe, expect, it } from 'vitest';
import { ConfigError, integer, readEnv, url } from '../../../src/infrastructure/config/env-schema.ts';

describe('integer rule', () => {
  const port = integer({ min: 1, max: 65_535, fallback: 3000 });
  const required = integer({ min: 1 });

  it('parses trimmed decimal integers within the range', () => {
    expect(port(' 8080 ')).toEqual({ ok: true, value: 8080 });
    expect(port('65535')).toEqual({ ok: true, value: 65_535 });
  });

  it('uses the fallback for unset or blank values', () => {
    expect(port(undefined)).toEqual({ ok: true, value: 3000 });
    expect(port('   ')).toEqual({ ok: true, value: 3000 });
  });

  it('requires a value when there is no fallback', () => {
    expect(required(undefined)).toEqual({ ok: false, problem: 'is required' });
  });

  it.each(['0', '65536', '-1', '1.5', '1e3', '0x10', 'abc'])('rejects %s', (raw) => {
    expect(port(raw)).toEqual({ ok: false, problem: 'must be a whole number between 1 and 65535' });
  });

  it('rejects integers beyond the safe range by default', () => {
    expect(required('9007199254740993').ok).toBe(false);
  });
});

describe('url rule', () => {
  const database = url({ protocols: ['postgres:', 'postgresql:'], requirePath: true });
  const website = url({ protocols: ['https:'] });

  it('returns the normalized href', () => {
    expect(website(' https://origin.test ')).toEqual({ ok: true, value: 'https://origin.test/' });
    expect(database('postgresql://user:secret@db:5432/app')).toEqual({
      ok: true,
      value: 'postgresql://user:secret@db:5432/app',
    });
  });

  it.each([
    ['unset', undefined, 'is required'],
    ['not a URL', 'localhost:5432', 'must be an absolute postgres: or postgresql: URL with a host and a path'],
    ['wrong scheme', 'https://db/app', 'must be an absolute postgres: or postgresql: URL with a host and a path'],
    ['no host', 'postgresql:///app', 'must be an absolute postgres: or postgresql: URL with a host and a path'],
    ['no database name', 'postgresql://db:5432', 'must be an absolute postgres: or postgresql: URL with a host and a path'],
  ])('rejects a URL that is %s', (_, raw, problem) => {
    expect(database(raw)).toEqual({ ok: false, problem });
  });

  it('never includes the rejected value, which may hold a password', () => {
    const result = database('mysql://user:hunter2@db/app');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });
});

describe('readEnv', () => {
  const schema = {
    PORT: integer({ min: 1, max: 65_535, fallback: 3000 }),
    SITE: url({ protocols: ['https:'] }),
  };

  it('returns typed values keyed by variable name', () => {
    expect(readEnv({ SITE: 'https://origin.test' }, schema)).toEqual({ PORT: 3000, SITE: 'https://origin.test/' });
  });

  it('reports every invalid variable in one error', () => {
    const read = () => readEnv({ PORT: '0' }, schema);

    expect(read).toThrow(ConfigError);
    expect(read).toThrow(expect.objectContaining({
      problems: ['PORT must be a whole number between 1 and 65535', 'SITE is required'],
    }));
  });
});
