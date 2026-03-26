import { defineError, DomainErrorBase } from './domain-error';

export const SomethingWentWrongError = defineError(
  class SomethingWentWrongError extends DomainErrorBase {
    public static readonly code = 'SomethingWentWrongError';
  },
);

export type SomethingWentWrongError = InstanceType<typeof SomethingWentWrongError>;
