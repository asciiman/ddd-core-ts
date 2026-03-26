import { DomainEvent } from './domain-event';

type Callback<T extends DomainEvent> = (event: T) => void;
export type UnregisterFunction = () => void;

export class DomainEvents {
  private static handlersMap: { [key: string]: Array<Callback<any>> } = {};

  /**
   * Registers a callback for a given event.
   * @param eventCode The code of the event to listen to.
   * @param callback The callback to be called when the event is dispatched.
   */
  public static register<T extends DomainEvent>(
    eventCode: string,
    callback: Callback<T>,
  ): UnregisterFunction {
    if (!this.handlersMap[eventCode]) {
      this.handlersMap[eventCode] = [];
    }
    this.handlersMap[eventCode].push(callback);

    return () => {
      this.handlersMap[eventCode] = this.handlersMap[eventCode].filter(
        (handler) => handler !== callback,
      );
    };
  }

  public static dispatch(event: DomainEvent): void {
    const handlers = this.handlersMap[event.code];
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }
}
