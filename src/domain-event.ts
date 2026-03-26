export interface DomainEvent {
  readonly occurredAt: Date;
  readonly code: string;
}

/**
 * Ensures that the class has a static `code` property.
 */
type EventClass<Args extends any[] = any[], T extends DomainEvent = DomainEvent> = {
  new (...args: Args): T;
  code: string;
};

/**
 * Helper that enforces the static side on the class value.
 *
 * Use like:
 * ```typescript
 * export const MyEvent = defineEvent(
 *   class MyEvent extends DomainEventBase {
 *     static readonly code = 'MyEvent';
 *     constructor(public readonly someData: string) {
 *       super();
 *     }
 *   },
 * );
 */
export function defineEvent<C extends EventClass>(cls: C): C {
  return cls;
}

/**
 * Base class for domain events.
 */
export abstract class DomainEventBase implements DomainEvent {
  public readonly occurredAt = new Date();

  // Keep instance `code` in sync with the class static
  get code(): string {
    return (this.constructor as EventClass).code;
  }
}
