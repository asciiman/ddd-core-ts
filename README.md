# ddd-core

TypeScript building blocks for Domain-Driven Design. Provides base classes and utilities for entities, value objects, use cases, domain errors, domain events, and more.

## Install

```bash
pnpm add ddd-core
```

## Concepts

### ValueObject

Immutable objects compared by structural equality. Use for domain concepts that have no identity of their own — names, addresses, amounts, etc.

```ts
import { ValueObject } from 'ddd-core';

interface MoneyProps {
  amount: number;
  currency: string;
}

class Money extends ValueObject<MoneyProps> {
  get amount() { return this.props.amount; }
  get currency() { return this.props.currency; }

  static create(amount: number, currency: string): Money {
    return new Money({ amount, currency });
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return Money.create(this.amount + other.amount, this.currency);
  }
}

const a = Money.create(10, 'USD');
const b = Money.create(10, 'USD');
a.equals(b); // true — compared by props, not reference
```

Props are frozen on construction, enforcing immutability. Business methods should return new instances rather than mutating state.

### Entity

Objects with a unique identity. Two entities are equal when their IDs match, regardless of other properties.

```ts
import { Entity } from 'ddd-core';

interface OrderProps {
  items: string[];
  total: number;
}

class Order extends Entity<OrderProps> {
  get items() { return this.props.items; }
  get total() { return this.props.total; }

  static create(id: string, items: string[], total: number): Order {
    return new Order({ items, total }, id);
  }
}
```

### UseCase

Interface for application-layer operations. Each use case has a `code` for identification and an `execute` method.

```ts
import { UseCase } from 'ddd-core';

interface PlaceOrderRequest {
  items: string[];
}

class PlaceOrderUseCase implements UseCase<PlaceOrderRequest, Order> {
  readonly code = 'PlaceOrderUseCase';

  constructor(private readonly orderStore: OrderStore) {}

  async execute(request: PlaceOrderRequest): Promise<Order> {
    const order = Order.create(generateId(), request.items, calculateTotal(request.items));
    await this.orderStore.save(order);
    return order;
  }
}
```

Use cases depend on domain interfaces (like `OrderStore`), not concrete implementations. This keeps the application layer decoupled from infrastructure.

### DomainError

Type-safe errors with a static `code` for identification. Define them with `defineError` to enforce the static `code` property at the type level.

```ts
import { defineError, DomainErrorBase } from 'ddd-core';

export const OrderNotFoundError = defineError(
  class OrderNotFoundError extends DomainErrorBase {
    static readonly code = 'OrderNotFoundError';

    constructor(orderId: string) {
      super(`Order ${orderId} not found.`);
    }
  },
);

// Export the instance type so consumers can use it as a type
export type OrderNotFoundError = InstanceType<typeof OrderNotFoundError>;
```

The instance `code` getter stays in sync with the static property, so you can check errors by code:

```ts
if (error.code === OrderNotFoundError.code) { ... }
```

### ResultOrError

A discriminated union for operations that can fail in expected ways. Use instead of throwing exceptions for expected domain failures.

```ts
import { ResultOrError } from 'ddd-core';

class GetOrderUseCase implements UseCase<string, ResultOrError<Order, OrderNotFoundError>> {
  readonly code = 'GetOrderUseCase';

  async execute(orderId: string): Promise<ResultOrError<Order, OrderNotFoundError>> {
    const order = await this.orderStore.findById(orderId);
    if (!order) {
      return ResultOrError.error(new OrderNotFoundError(orderId));
    }
    return ResultOrError.success(order);
  }
}

// Caller
const result = await getOrderUseCase.execute('abc');
if (result.success) {
  console.log(result.result); // Order
} else {
  console.log(result.error);  // OrderNotFoundError
}
```

`ResultOrError.success()` can also be called with no argument for void results.

### DomainEvent

Events representing something that happened in the domain. Define them with `defineEvent`, dispatch and listen via `DomainEvents`.

```ts
import { defineEvent, DomainEventBase, DomainEvents } from 'ddd-core';

export const OrderPlaced = defineEvent(
  class OrderPlaced extends DomainEventBase {
    static readonly code = 'OrderPlaced';

    constructor(
      public readonly orderId: string,
      public readonly total: number,
    ) {
      super(); // sets occurredAt automatically
    }
  },
);

export type OrderPlaced = InstanceType<typeof OrderPlaced>;
```

**Dispatching:**

```ts
DomainEvents.dispatch(new OrderPlaced(order.id, order.total));
```

**Listening:**

```ts
const unregister = DomainEvents.register<OrderPlaced>(
  OrderPlaced.code,
  (event) => {
    console.log(`Order ${event.orderId} placed at ${event.occurredAt}`);
  },
);

// Later, clean up
unregister();
```

### ProcessManager

Interface for long-running background processes. Process managers typically listen for domain events and coordinate reactions across the system.

```ts
import { ProcessManager, DomainEvents, UnregisterFunction } from 'ddd-core';

class OrderFulfillmentProcessManager implements ProcessManager {
  private unregisterFns: UnregisterFunction[] = [];

  constructor(private readonly fulfillmentService: FulfillmentService) {}

  start() {
    const unregister = DomainEvents.register<OrderPlaced>(
      OrderPlaced.code,
      (event) => this.fulfillmentService.beginFulfillment(event.orderId),
    );
    this.unregisterFns.push(unregister);
  }

  close() {
    this.unregisterFns.forEach((fn) => fn());
  }
}
```

### handleRequest

Utility for wiring up a controller endpoint. Maps an incoming DTO to domain objects, executes a use case, and maps the result back to a response DTO.

```ts
import { handleRequest, HandlerDefinition } from 'ddd-core';

const getOrderHandler: HandlerDefinition<
  { orderId: string },  // Request DTO
  string,               // Domain request (mapped)
  Order,                // Domain response
  OrderDTO              // Response DTO (mapped)
> = {
  requestMapper: { mapDTOToDomain: (dto) => dto.orderId },
  responseMapper: { mapDomainToDTO: (order) => toOrderDTO(order) },
  useCaseExecutor: getOrderUseCase,
};

const result = await handleRequest(getOrderHandler, { orderId: 'abc' });
if (result.success) {
  respond(result.result); // OrderDTO
} else {
  respondError(result.error); // SomethingWentWrongError
}
```

Errors thrown during mapping or execution are caught and wrapped in a `SomethingWentWrongError`.

### ErrorFormatter

Recursively formats error messages and stack traces through `cause` chains.

```ts
import { ErrorFormatter } from 'ddd-core';

const root = new Error('connection refused');
const wrapper = new Error('failed to save order', { cause: root });

ErrorFormatter.getMessage(wrapper);
// "failed to save order\nCaused by: connection refused"

ErrorFormatter.getStack(wrapper);
// Full stack trace with "Caused by:" separators
```

Handles circular references gracefully.

## Project Structure

When using ddd-core in a project, a typical DDD layout looks like this:

```
src/
├── domain/                  # Pure business logic, no framework dependencies
│   ├── Order.ts             # Aggregates and value objects
│   ├── OrderStore.ts        # Interfaces that infrastructure must implement
│   ├── events/              # Domain events
│   └── errors/              # Domain errors
├── use-cases/               # Application logic, orchestrates domain objects
│   ├── PlaceOrderUseCase.ts
│   └── GetOrderUseCase.ts
└── infrastructure/          # Technology-specific implementations
    ├── controllers/         # Adapts use cases to external interface (uses handleRequest)
    ├── stores/              # Implements domain store interfaces
    └── processes/           # ProcessManagers for background work
```

- **Domain** defines what, **use cases** define when, **infrastructure** defines how.
- Domain and use-case layers should have no imports from infrastructure.
- Infrastructure implements domain interfaces and wires everything together.

## API Reference

| Export | Kind | Description |
|---|---|---|
| `Entity<T>` | Abstract class | Base for identity-based domain objects |
| `ValueObject<T>` | Abstract class | Base for structurally-compared immutable objects |
| `UseCase<Req, Res>` | Interface | Contract for application-layer operations |
| `ResultOrError<R, E>` | Type + namespace | Discriminated union for success/error results |
| `DomainErrorBase` | Abstract class | Base class for domain errors (extends `Error`) |
| `defineError(cls)` | Function | Enforces static `code` property on error classes |
| `DomainEventBase` | Abstract class | Base class for domain events (auto-sets `occurredAt`) |
| `defineEvent(cls)` | Function | Enforces static `code` property on event classes |
| `DomainEvents` | Static class | Global event dispatcher — `register()` and `dispatch()` |
| `ProcessManager` | Interface | Lifecycle interface with `start()` and `close()` |
| `handleRequest(def, dto)` | Function | Maps DTO → domain → use case → response DTO |
| `SomethingWentWrongError` | Error class | Generic fallback error used by `handleRequest` |
| `ErrorFormatter` | Static class | Formats error messages/stacks through cause chains |
