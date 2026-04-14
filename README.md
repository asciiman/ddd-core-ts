# ddd-core-ts

TypeScript building blocks for Domain-Driven Design. Provides base classes and utilities for entities, value objects, use cases, domain errors, domain events, and more.

## Install

```bash
npm install ddd-core-ts
```

## Why DDD

DDD is the right approach when the complexity of your system lives in the domain, not the technology. DDD allows you to:

* Model the domain accurately before writing code
* Use a shared language (ubiquitous language) across planning docs, code, and UI
* Define clear boundaries between subdomains
* Keep the core domain logic independent of infrastructure concerns

---

## Architecture Layers

The architecture follows classic DDD layering with three main layers:

| Layer | Purpose | Dependencies |
|---|---|---|
| **Domain** | Pure business logic, entities, value objects, events, errors, store interfaces | None (no infrastructure imports) |
| **Use Cases** | Application logic, orchestrates domain objects | Domain layer only |
| **Infrastructure** | Technical implementations (storage, APIs, external services) | Domain + Use Cases |

**Key principles:**

* The domain layer has zero dependencies on infrastructure or frameworks.
* Dependencies flow inward: Infrastructure -> Use Cases -> Domain.
* All dependencies are injected via constructors (no singletons, no service locators).

---

## Core Principles

### Ubiquitous Language

Every concept in the codebase must use the same term used in planning documents and domain discussions. If the domain calls it a "reservation", the code calls it a `Reservation` — not a `Booking`, `Hold`, or `Slot`.

Choose your domain terms deliberately and use them consistently across code, documentation, and conversation. When a term is ambiguous, resolve it once in the domain model and enforce it everywhere.

### Bounded Contexts

Divide your system into bounded contexts, each with its own models and rules. Objects with the same name in different contexts may have different meanings and structures.

Each bounded context should be a separate package or module with clear boundaries. Cross-context communication happens through domain events or explicit interfaces — never through shared mutable state.

### Aggregates

Each bounded context defines its own aggregates. An aggregate is a cluster of domain objects treated as a single unit for data changes.

* Aggregates enforce invariants (e.g., an order cannot have negative totals)
* Cross-aggregate references use IDs, not direct object references
* Each aggregate has a single root entity

### Domain Model Baseline

The domain model should be established **before** writing application code:

1. **Concept diagram** — visual map of domain objects, relationships, and flows
2. **Review and iterate** — align the team on naming, boundaries, and aggregates
3. **Translate to code** — entities, value objects, aggregates, stores
4. **Translate to database** — schema derived from the domain model, not the other way around

---

## Project Structure

Within each bounded context package:

```
src/
├── domain/                              # Pure business logic
│   ├── MyAggregate.ts                   # Aggregate root
│   ├── MyAggregateStore.ts              # Repository interface
│   ├── SomeValueObject.ts              # Value object
│   ├── some-sub-entity/                # Related entity group
│   │   ├── SubEntity.ts
│   │   └── SomeDomainError.ts
│   └── events/                          # Domain events
│       └── SomethingHappened.ts
│
├── use-cases/                           # Application layer
│   ├── DoSomethingUseCase.ts
│   └── some-feature/
│       └── FeatureUseCase.ts
│
└── infrastructure/                      # Technical implementations
    ├── controllers/                     # API/entry point controllers
    │   └── MyController/
    │       ├── MyController.ts
    │       └── maps/                    # DTO mappers for this boundary
    │           ├── domain/
    │           └── use-cases/
    ├── stores/                          # Repository implementations
    │   └── ConcreteMyAggregateStore/
    │       ├── ConcreteMyAggregateStore.ts
    │       └── maps/
    └── processes/                       # Process managers (sagas)
        └── SomeProcessManager.ts
```

**Rules:**

* **Domain** defines what, **use cases** define when, **infrastructure** defines how.
* Domain and use-case layers should have no imports from infrastructure.
* Infrastructure implements domain interfaces and wires everything together.
* One public interface per file. Filename matches the class name.
* Group related domain concepts into subdirectories within `domain/`.
* Each infrastructure implementation gets its own directory (allows co-locating its mappers and helpers).

---

## Patterns and API

### ValueObject

Immutable objects compared by structural equality. Use for domain concepts that have no identity of their own — names, addresses, amounts, etc.

`ValueObject<T>`:
* Freezes props at construction time (immutability).
* Provides `equals(vo?: ValueObject<T>): boolean` using shallow property comparison.
* Props are accessed via `this.props`.

#### Simple Value Object (wrapping a single primitive)

```typescript
import { ValueObject } from 'ddd-core-ts';
import { z } from 'zod';

const EmailPropsSchema = z.object({
  emailValue: z.string().email(),
});
type EmailProps = z.infer<typeof EmailPropsSchema>;

export class Email extends ValueObject<EmailProps> {

  public getValue(): string {
    return this.props.emailValue;
  }

  public static create(props: EmailProps): Email {
    const validatedProps = EmailPropsSchema.parse(props);
    return new Email(validatedProps);
  }

  public static fromString(email: string): Email {
    return Email.create({ emailValue: email });
  }
}
```

#### Complex Value Object (multiple properties)

```typescript
const AddressPropsSchema = z.object({
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
});
type AddressProps = z.infer<typeof AddressPropsSchema>;

export class Address extends ValueObject<AddressProps> {

  public get street(): string {
    return this.props.street;
  }

  public get city(): string {
    return this.props.city;
  }

  public get postalCode(): string {
    return this.props.postalCode;
  }

  public static create(props: AddressProps): Address {
    const validatedProps = AddressPropsSchema.parse(props);
    return new Address(validatedProps);
  }
}
```

#### Enum-like Constants

For fixed sets of domain values, use `as const` objects with a matching type alias:

```typescript
export const OrderStatus = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
} as const;
export type OrderStatus = keyof typeof OrderStatus;
```

#### Immutable Aggregate Pattern

Aggregates are often implemented as ValueObjects with copy-and-modify methods:

```typescript
export class Order extends ValueObject<OrderProps> {

  public get status(): OrderStatus {
    return this.props.status;
  }

  public get items(): OrderItem[] {
    return this.props.items;
  }

  public toConfirmedOrder(): Order {
    return Order.create({
      ...this.props,
      status: OrderStatus.Confirmed,
    });
  }

  public static create(props: OrderProps): Order {
    const validatedProps = OrderPropsSchema.parse(props);
    return new Order(validatedProps);
  }
}
```

#### Value Object Rules

* **Always validate via Zod** in `create()`. Invalid data throws a Zod error at creation time — no invalid value objects can exist.
* **No setters.** Value objects are immutable. Operations that "change" a value return a new instance.
* **Getters for all properties.** Never expose `this.props` directly.
* **Override `equals()`** when shallow comparison isn't sufficient (e.g., case-insensitive string comparison).

---

### Entity

Objects with a unique identity that persists over time. Two entities are equal when their IDs match, regardless of other properties.

`Entity<T>`:
* Has an `id: EntityID` (string).
* Equality is identity-based (`entity1.equals(entity2)` compares IDs).
* Props are not frozen (entities can mutate — but prefer immutable patterns where practical).

```typescript
import { Entity } from 'ddd-core-ts';

interface OrderLineProps {
  productId: string;
  quantity: number;
  unitPrice: number;
}

class OrderLine extends Entity<OrderLineProps> {
  get productId() { return this.props.productId; }
  get quantity() { return this.props.quantity; }
  get total() { return this.props.quantity * this.props.unitPrice; }

  static create(id: string, props: OrderLineProps): OrderLine {
    return new OrderLine(props, id);
  }
}
```

#### When to use Entity vs ValueObject

| Use Entity when... | Use ValueObject when... |
|---|---|
| The object has a lifecycle with identity | The object is defined entirely by its attributes |
| You need mutable state tracking | Immutability is acceptable or preferred |
| Identity must survive property changes | Two objects with the same properties are interchangeable |

---

### UseCase

Interface for application-layer operations. Each use case has a `code` for identification and an `execute` method.

```typescript
import { UseCase } from 'ddd-core-ts';

interface UseCase<Request, Response> {
  code: string;
  execute(request?: Request): Promise<Response> | Response;
}
```

#### Standard Pattern

```typescript
export interface GetItemsUseCaseProps {
  status: ItemStatus | undefined;
}

export class GetItemsUseCase implements UseCase<GetItemsUseCaseProps, Item[]> {
  public readonly code = 'GetItemsUseCase';

  constructor(private readonly itemStore: ItemStore) {}

  public async execute({ status }: GetItemsUseCaseProps): Promise<Item[]> {
    try {
      const allItems = await this.itemStore.getAllItems();
      if (status === undefined) return allItems;
      return allItems.filter((item) => item.status === status);
    } catch (cause) {
      throw new Error('Error while getting items', { cause });
    }
  }
}
```

#### Use Case with Domain Events

```typescript
export class UpdateItemUseCase implements UseCase<UpdateItemUseCaseProps, void> {
  public readonly code = 'UpdateItemUseCase';

  constructor(private readonly itemStore: ItemStore) {}

  public async execute(props: UpdateItemUseCaseProps): Promise<void> {
    try {
      await this.itemStore.saveItem(props.item);
      DomainEvents.dispatch(
        new ItemUpdated(props.item.id, props.item.name),
      );
    } catch (cause) {
      throw new Error('Error updating item', { cause });
    }
  }
}
```

#### Use Case with Composed Dependencies

```typescript
export class ComplexOperationUseCase
  implements UseCase<ComplexOperationUseCaseProps, OperationResult>
{
  public readonly code = 'ComplexOperationUseCase';

  constructor(
    private readonly primaryStore: PrimaryStore,
    private readonly secondaryStore: SecondaryStore,
    private readonly validationUseCase: ValidateInputUseCase,
    private readonly externalService: ExternalService,
  ) {}

  public async execute(props: ComplexOperationUseCaseProps): Promise<OperationResult> {
    const validationResult = await this.validationUseCase.execute(props.input);
    if (!validationResult.success) {
      throw validationResult.error;
    }
    // Orchestrate domain operations
    // ...
  }
}
```

#### Use Case Rules

* **`code` field**: Every use case has a `public readonly code` string matching the class name. Used for logging and handler registration.
* **Single `execute()` method**: This is the only public method besides `code`.
* **Constructor injection**: All dependencies (stores, other use cases, services) are injected via the constructor.
* **Error wrapping**: Catch errors and re-throw with context using `new Error('message', { cause })`.
* **Domain events**: Dispatch events *after* successful state changes, not before.
* **No infrastructure imports**: Use cases depend only on domain interfaces (stores), never concrete implementations.

---

### DomainError

Type-safe errors with a static `code` for identification. Define them with `defineError` to enforce the static `code` property at the type level.

```typescript
import { defineError, DomainErrorBase } from 'ddd-core-ts';

export const ItemNotFoundError = defineError(
  class ItemNotFoundError extends DomainErrorBase {
    public static readonly code = 'ItemNotFoundError';

    constructor(itemId: string) {
      super(`Item with ID '${itemId}' was not found.`);
    }
  },
);

export type ItemNotFoundError = InstanceType<typeof ItemNotFoundError>;
```

The instance `code` getter stays in sync with the static property, so you can check errors by code:

```typescript
if (error instanceof DomainErrorBase && error.code === ItemNotFoundError.code) {
  // Handle specifically
}
```

#### Error Wrapping Pattern

For unexpected/infrastructure errors, wrap with context using native Error cause chains:

```typescript
try {
  await this.store.save(entity);
} catch (cause) {
  throw new Error(`Error saving entity ${entity.id}`, { cause });
}
```

#### Error Rules

* **`defineError()` wrapper**: Always use it. Enforces the static `code` contract.
* **Static `code`**: Must match the class name.
* **Descriptive message**: The constructor should produce a human-readable message.
* **Type export pattern**: Export both the class (via `defineEvent`) and the instance type (via `InstanceType<typeof>`).
* **Domain errors for known failures, Error wrapping for unexpected failures.**

---

### ResultOrError

A discriminated union for operations that can fail in expected ways. Use instead of throwing exceptions for expected domain failures.

```typescript
import { ResultOrError } from 'ddd-core-ts';

type ResultOrError<Result, Error> =
  | { success: true; result: Result }
  | { success: false; error: Error };
```

#### Usage

```typescript
public async validateOrder(
  orderId: OrderId,
): Promise<ResultOrError<void, InvalidOrderError>> {
  const order = await this.orderStore.getById(orderId);
  if (!order) {
    return ResultOrError.error(new InvalidOrderError());
  }
  return ResultOrError.success();
}

// Consuming:
const result = await this.validateUseCase.execute(props);
if (result.success) {
  console.log(result.result);
} else {
  console.log(result.error);
}
```

`ResultOrError.success()` can also be called with no argument for void results.

#### When to use ResultOrError vs throw

| Use `ResultOrError` when... | Use `throw` when... |
|---|---|
| The caller is expected to handle the failure | The failure is exceptional/unexpected |
| Multiple known failure modes exist | A single error type suffices |
| The function is a validation or query | The function is a command/mutation |

---

### DomainEvent

Events representing something meaningful that happened in the domain. They enable loose coupling between aggregates and trigger side effects. Define them with `defineEvent`, dispatch and listen via `DomainEvents`.

```typescript
import { defineEvent, DomainEventBase, DomainEvents } from 'ddd-core-ts';

export const OrderPlaced = defineEvent(
  class OrderPlaced extends DomainEventBase {
    public static readonly code = 'OrderPlaced';

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

```typescript
DomainEvents.dispatch(new OrderPlaced(order.id, order.total));
```

**Listening:**

```typescript
const unregister = DomainEvents.register<OrderPlaced>(
  OrderPlaced.code,
  (event) => {
    console.log(`Order ${event.orderId} placed at ${event.occurredAt}`);
  },
);

// Clean up when shutting down:
unregister();
```

#### Event Rules

* **Static `code` property**: Must match the class name. Used for routing.
* **Primitive constructor args**: Event constructors take primitives (string, number), not domain objects. This keeps events serializable and decoupled.
* **`defineEvent()` wrapper**: Always wrap the class with `defineEvent()`. This enforces the static `code` contract.
* **Type export pattern**: Export both the class (via `defineEvent`) and the instance type (via `InstanceType<typeof>`).
* **Dispatch after success**: Only dispatch events after the operation that caused them has succeeded.

---

### Stores (Repository Pattern)

Repositories are called "Stores" in this codebase. The interface lives in the domain layer; the implementation lives in infrastructure.

#### Domain Interface

```typescript
// domain/ItemStore.ts
export interface ItemStore {
  getItemById(id: ItemId): Promise<Item | undefined>;
  getAllItems(): Promise<Item[]>;
  saveItem(item: Item): Promise<void>;
  deleteItem(id: ItemId): Promise<void>;
  itemExists(id: ItemId): Promise<boolean>;
  reset(): Promise<void>;
}
```

#### Infrastructure Implementation

```typescript
// infrastructure/stores/ConcreteItemStore/ConcreteItemStore.ts
export class ConcreteItemStore implements ItemStore {

  private constructor(
    private readonly storage: StorageWrapper<ItemSchema>,
  ) {}

  public static async load(adapter: StorageAdapter): Promise<ConcreteItemStore> {
    const storage = await ItemStorage.load(adapter);
    return new ConcreteItemStore(storage);
  }

  public async getItemById(id: ItemId): Promise<Item | undefined> {
    const dto = await this.storage.get(id.getValue());
    if (!dto) return undefined;
    return ItemMap.mapDTOToDomain(dto);
  }

  public async saveItem(item: Item): Promise<void> {
    const dto = ItemMap.mapDomainToDTO(item);
    await this.storage.put(dto);
  }

  // ... remaining interface methods
}
```

#### Store Rules

* **Interface in domain, implementation in infrastructure.** The domain never knows about storage details.
* **Async factory (`load()`)** for stores that need initialization (loading adapters, running migrations).
* **Private constructor** when using async factories.
* **Mapper usage**: Stores use mappers to convert between domain objects and storage DTOs.
* **Aggregate composition**: A store for an aggregate root may depend on stores for its child entities.

---

### Mappers and DTOs

Mappers translate between domain objects and DTOs (Data Transfer Objects) at architectural boundaries.

```typescript
export interface ItemDTO {
  id: string;
  name: string;
  status: string;
  createdAt: number;
}

// Domain -> DTO
export function mapDomainToDTO(item: Item): ItemDTO {
  return {
    id: item.id.getValue(),
    name: item.name.getValue(),
    status: item.status,
    createdAt: item.createdAt.getTime(),
  };
}

// DTO -> Domain
export function mapDTOToDomain(dto: ItemDTO): Item {
  return Item.create({
    id: ItemId.fromString(dto.id),
    name: ItemName.fromString(dto.name),
    status: dto.status as ItemStatus,
    createdAt: new Date(dto.createdAt),
  });
}
```

#### Mapper Organization

Mappers are organized by boundary. The same domain object may have different DTO representations at different boundaries:

```
infrastructure/
├── controllers/MyController/maps/
│   ├── domain/                    # API DTOs (what external callers see)
│   │   └── ItemMap.ts
│   └── use-cases/                 # Use case input/output mappers
│       └── CreateItemMap.ts
└── stores/ConcreteStore/maps/     # Storage DTOs (what gets persisted)
    └── ItemMap.ts
```

#### Mapper Rules

* **Namespace imports**: Import mappers as namespaces: `import * as ItemMap from './ItemMap'`.
* **Naming**: Functions are always `mapDomainToDTO()` and `mapDTOToDomain()`.
* **Recursive**: Mappers for complex objects call child mappers for nested value objects.
* **Co-located**: Mappers live next to the code that uses them, not in the domain layer.
* **No domain logic**: Mappers are pure data transformations.

---

### handleRequest

Utility for wiring up a controller endpoint. Maps an incoming DTO to domain objects, executes a use case, and maps the result back to a response DTO.

```typescript
import { handleRequest, HandlerDefinition } from 'ddd-core-ts';

interface HandlersRecord {
  getItem: HandlerDefinition<
    GetItemRequestDTO,     // Request DTO (external input)
    GetItemRequest,        // Domain request (mapped input)
    Item,                  // Domain response (use case output)
    ItemDTO                // Response DTO (external output)
  >;
}

const handlers: HandlersRecord = {
  getItem: {
    requestMapper: GetItemRequestMap,
    responseMapper: ItemMap,
    useCaseExecutor: getItemUseCase,
  },
};

// In the controller method:
public async getItem(dto: GetItemRequestDTO) {
  return handleRequest(this.handlers.getItem, dto);
}
```

`handleRequest` orchestrates the full pipeline:

1. Map request DTO -> domain object (via `requestMapper`)
2. Execute the use case
3. Map domain response -> response DTO (via `responseMapper`)
4. Return `ResultOrError<ResponseDTO, SomethingWentWrongError>`

Errors thrown during mapping or execution are caught and wrapped in a `SomethingWentWrongError`.

#### Controller Loading Pattern

Controllers use an async factory that wires up all dependencies:

```typescript
export class MyController {
  private constructor(
    private readonly handlers: HandlersRecord,
    private readonly processManagers: ProcessManager[],
  ) {}

  public static async load(
    storageAdapter: StorageAdapter,
  ): Promise<MyController> {
    // 1. Initialize stores
    const itemStore = await ConcreteItemStore.load(storageAdapter);

    // 2. Create use cases
    const getItemUseCase = new GetItemUseCase(itemStore);

    // 3. Wire handlers
    const handlers: HandlersRecord = {
      getItem: {
        requestMapper: GetItemRequestMap,
        responseMapper: ItemMap,
        useCaseExecutor: getItemUseCase,
      },
    };

    // 4. Create process managers
    const processManagers = [
      new SomeProcessManager(itemStore),
    ];

    return new MyController(handlers, processManagers);
  }

  public async getItem(dto: GetItemRequestDTO) {
    return handleRequest(this.handlers.getItem, dto);
  }
}
```

#### Module Exports

The controller is typically re-exported as the "Subdomain" — the public face of the package:

```typescript
// src/index.ts
export { MyController as MySubdomain } from './infrastructure/controllers/MyController/MyController';

// Domain objects needed by consumers
export { Item } from './domain/Item';
export type { ItemDTO } from './infrastructure/controllers/MyController/maps/domain/ItemMap';

// Events (for cross-subdomain listening)
export { ItemUpdated } from './domain/events/ItemUpdated';

// Errors (for typed error handling)
export { ItemNotFoundError } from './domain/errors/ItemNotFoundError';
```

---

### ProcessManager

Interface for long-running background processes. Process managers typically listen for domain events and coordinate reactions across the system.

```typescript
import { ProcessManager, DomainEvents, UnregisterFunction } from 'ddd-core-ts';

interface ProcessManager {
  start(): void | Promise<void>;
  close(): void | Promise<void>;
}
```

#### Implementation Pattern

```typescript
class OrderFulfillmentProcessManager implements ProcessManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly eventUnregisterFunctions: UnregisterFunction[] = [];

  constructor(
    private readonly orderStore: OrderStore,
    private readonly fulfillOrderUseCase: FulfillOrderUseCase,
  ) {}

  public start(): void {
    this.eventUnregisterFunctions.push(
      DomainEvents.register(OrderPlaced.code, this.onOrderPlaced.bind(this)),
    );
  }

  public close(): void {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
    this.eventUnregisterFunctions.forEach((unregister) => unregister());
  }

  private onOrderPlaced(event: OrderPlaced): void {
    // Start polling or other background work
  }
}
```

---

### ErrorFormatter

Recursively formats error messages and stack traces through `cause` chains.

```typescript
import { ErrorFormatter } from 'ddd-core-ts';

const root = new Error('connection refused');
const wrapper = new Error('failed to save order', { cause: root });

ErrorFormatter.getMessage(wrapper);
// "failed to save order\nCaused by: connection refused"

ErrorFormatter.getStack(wrapper);
// Full stack trace with "Caused by:" separators
```

Handles circular references gracefully.

---

## Code Conventions

### Naming

| Element | Convention | Example |
|---|---|---|
| Classes / Types | PascalCase | `ProfileAddress` |
| Files | PascalCase matching class name | `ProfileAddress.ts` |
| Methods / properties | camelCase | `getChecksumValue()` |
| Constants | PascalCase (for `as const` objects) | `OrderStatus` |
| Interfaces | PascalCase, no `I` prefix | `ProfileStore` (not `IProfileStore`) |
| Props types | `{ClassName}Props` | `ProfileAddressProps` |
| Zod schemas | `{ClassName}PropsSchema` | `ProfileAddressPropsSchema` |
| Use case props | `{UseCaseName}Props` | `GetProfilesUseCaseProps` |
| DTOs | `{ClassName}DTO` | `ProfileDTO` |
| Mapper functions | `mapDomainToDTO` / `mapDTOToDomain` | — |
| Domain objects | Ubiquitous language — no abbreviations, no generic names | — |

### TypeScript Practices

* **Zod for validation**: All domain object props are validated with Zod schemas at creation time.
* **Strict types**: Prefer domain value objects over primitives in domain and use case layers. Primitives are acceptable in DTOs and events.
* **`readonly` by default**: Constructor dependencies are `private readonly`.
* **`as const` over enums**: Use `as const` objects with a type alias instead of TypeScript enums.
* **No default exports**: Always use named exports.

### Error Handling

* Domain errors are typed using `defineError()` for known/expected failure modes.
* Infrastructure errors are caught at the boundary and wrapped with `new Error('context', { cause })`.
* Use `ResultOrError` when the caller should explicitly handle the failure.
* Never swallow errors silently.

### Dependency Injection

* All dependencies are injected via constructor parameters.
* Dependencies are typed as interfaces (from the domain layer), never as concrete implementations.
* Complex wiring happens in the controller's `load()` factory method.

### Async Patterns

* All store/repository methods are async (`Promise<T>`).
* Use cases are async by default.
* Use `Promise.all()` for independent parallel operations.
* Always `await` in a `try/catch` for proper error context.

### Testing

* Unit tests for domain logic (no infrastructure dependencies).
* Integration tests for stores and adapters.
* End-to-end tests for critical flows.
* Test files colocated with source: `PolicyEngine.ts` -> `PolicyEngine.test.ts`.

Use domain factory methods to build test data — never construct objects with raw data:

```typescript
describe('GetItemsUseCase', () => {
  const testItem = Item.create({
    id: ItemId.fromString('test-id-1'),
    name: ItemName.fromString('Test Item'),
    status: ItemStatus.Active,
  });

  it('returns items filtered by status', async () => {
    const mockStore: ItemStore = {
      getAllItems: jest.fn().mockResolvedValue([testItem]),
      // ... other methods
    };

    const useCase = new GetItemsUseCase(mockStore);
    const result = await useCase.execute({ status: ItemStatus.Active });

    expect(result).toEqual([testItem]);
  });
});
```

---

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
| `handleRequest(def, dto)` | Function | Maps DTO -> domain -> use case -> response DTO |
| `SomethingWentWrongError` | Error class | Generic fallback error used by `handleRequest` |
| `ErrorFormatter` | Static class | Formats error messages/stacks through cause chains |
