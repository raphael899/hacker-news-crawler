/**
 * Declarative validation for environment variables.
 *
 * Each rule turns one raw `process.env` string into a typed value or explains
 * why it is invalid. `readEnv` applies a whole schema and reports every
 * problem at once, so a misconfigured deployment fails with one complete
 * message instead of one error per restart.
 */

/** Outcome of applying a rule: the parsed value, or a description of the problem. */
export type RuleResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: string };

/** Parses one raw variable. Blank values (empty or only spaces) count as missing. */
export type EnvRule<T> = (raw: string | undefined) => RuleResult<T>;

/** Maps variable names to the rule that parses each one. */
export type EnvSchema = Readonly<Record<string, EnvRule<unknown>>>;

/** The typed result of a schema: same keys, each with its rule's output type. */
export type ParsedEnv<S extends EnvSchema> = { readonly [K in keyof S]: S[K] extends EnvRule<infer T> ? T : never };

const valid = <T>(value: T): RuleResult<T> => ({ ok: true, value });
const invalid = (problem: string): RuleResult<never> => ({ ok: false, problem });

/** Only plain decimal digits: rejects `-1`, `1.5`, `1e3`, and `0x10`, which `Number()` would accept. */
const DECIMAL_DIGITS = /^\d+$/u;

/** Returns the trimmed value, or `undefined` when the variable is unset or blank. */
function present(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

export interface IntegerRuleOptions {
  /** Smallest accepted value (inclusive). */
  readonly min: number;
  /** Largest accepted value (inclusive). Defaults to the largest safe integer. */
  readonly max?: number;
  /** Value used when the variable is unset or blank. Omit it to make the variable required. */
  readonly fallback?: number;
}

/** A whole decimal number within `[min, max]`, such as a port or a duration in milliseconds. */
export function integer({ min, max = Number.MAX_SAFE_INTEGER, fallback }: IntegerRuleOptions): EnvRule<number> {
  return (raw) => {
    const text = present(raw);
    if (text === undefined) return fallback === undefined ? invalid('is required') : valid(fallback);

    const value = Number(text);
    const inRange = DECIMAL_DIGITS.test(text) && value >= min && value <= max;
    return inRange ? valid(value) : invalid(`must be a whole number between ${min} and ${max}`);
  };
}

export interface UrlRuleOptions {
  /** Accepted schemes, including the trailing colon, for example `https:`. */
  readonly protocols: readonly string[];
  /** Require a non-empty path, such as the database name in a PostgreSQL URL. */
  readonly requirePath?: boolean;
}

/**
 * An absolute URL with an allowed scheme and a host. Returns the normalized
 * `href`. Problems never echo the value, because URLs can contain passwords.
 */
export function url({ protocols, requirePath = false }: UrlRuleOptions): EnvRule<string> {
  const expected = `an absolute ${protocols.join(' or ')} URL with a host${requirePath ? ' and a path' : ''}`;

  return (raw) => {
    const text = present(raw);
    if (text === undefined) return invalid('is required');

    const parsed = URL.parse(text);
    const acceptable = parsed !== null &&
      protocols.includes(parsed.protocol) &&
      parsed.hostname !== '' &&
      (!requirePath || parsed.pathname.length > 1);
    return acceptable ? valid(parsed.href) : invalid(`must be ${expected}`);
  };
}

/** Raised when one or more variables are invalid; `problems` lists each one. */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/** Applies every rule in `schema` to `env` and returns the typed values, or throws one `ConfigError`. */
export function readEnv<S extends EnvSchema>(env: NodeJS.ProcessEnv, schema: S): ParsedEnv<S> {
  const values: Record<string, unknown> = {};
  const problems: string[] = [];

  for (const [name, rule] of Object.entries(schema)) {
    const result = rule(env[name]);
    if (result.ok) values[name] = result.value;
    else problems.push(`${name} ${result.problem}`);
  }

  if (problems.length > 0) throw new ConfigError(problems);
  return values as ParsedEnv<S>;
}
