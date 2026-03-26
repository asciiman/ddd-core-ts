export interface DomainError {
  readonly code: string;
}

/**
 * Ensures that the class has a static `code` property.
 */
type ErrorClass<Args extends any[] = any[], T extends DomainError = DomainError> = {
  new (...args: Args): T;
  /**
   * The error code. This is a serializable identifier that can be used in comparisons like:
   * ```typescript
   * if (error.code === MyError.code) { ... }
   * ```
   */
  code: string;
};

/**
 * Helper that enforces the static side on the class value.
 *
 * Use like:
 * ```typescript
 * export const MyError = defineError(
 *   class MyError extends DomainErrorBase {
 *     static readonly code = 'MyError';
 *     constructor(public readonly someData: string) {
 *       super();
 *     }
 *   },
 * );
 */
export function defineError<C extends ErrorClass>(cls: C): C {
  return cls;
}

/**
 * Base class for domain errors.
 */
export abstract class DomainErrorBase extends Error implements DomainError {
  /**
   * The error code. This is a serializable identifier that can be used in comparisons like:
   * ```typescript
   * if (error.code === MyError.code) { ... }
   * ```
   */
  // Keep instance `code` in sync with the class static
  get code(): string {
    return (this.constructor as ErrorClass).code;
  }
}
