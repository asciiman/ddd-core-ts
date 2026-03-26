import { ErrorFormatter } from './error-formatter';

describe('ErrorFormatter', () => {
  describe('cause is string', () => {
    const error = new Error('error message', { cause: 'cause message' });

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe('error message\nCaused by: "cause message"');
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
    });
  });

  describe('cause is undefined', () => {
    const error = new Error('error message');

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe('error message');
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
    });
  });

  describe('cause is Error without its own cause', () => {
    const causeError = new Error('cause message');
    const error = new Error('error message', { cause: causeError });

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe('error message\nCaused by: cause message');
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
    });
  });

  describe('cause is Error with its own cause', () => {
    const level1Cause = new Error('level 1 cause message', {
      cause: 'level 2 cause message',
    });
    const error = new Error('error message', { cause: level1Cause });

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe(
        'error message\nCaused by: level 1 cause message\nCaused by: "level 2 cause message"',
      );
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: Error: level 1 cause message');
    });
  });

  describe('has three layers of Errors with causes', () => {
    const level3Cause = new Error('level 3 cause message', {
      cause: 'level 4 cause message',
    });
    const level2Cause = new Error('level 2 cause message', {
      cause: level3Cause,
    });
    const level1Cause = new Error('level 1 cause message', {
      cause: level2Cause,
    });
    const error = new Error('error message', { cause: level1Cause });

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe(
        'error message\nCaused by: level 1 cause message\nCaused by: level 2 cause message\nCaused by: level 3 cause message\nCaused by: "level 4 cause message"',
      );
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: Error: level 1 cause message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: Error: level 2 cause message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: Error: level 3 cause message');
    });
  });

  describe('cause is Error', () => {
    const cause = new Error('cause message', { cause: 'root cause message' });
    const error = new Error('error message', { cause });

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe(
        'error message\nCaused by: cause message\nCaused by: "root cause message"',
      );
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: Error: cause message');
    });
  });

  describe('cause is circular (two errors refer to each other)', () => {
    const error1 = new Error('cause message');
    const error = new Error('error message', { cause: error1 });
    error1.cause = error;

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe(
        'error message\nCaused by: [Circular reference]',
      );
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: [Circular reference]');
    });
  });

  describe('cause is circular (cause is an object that contains circular dependency)', () => {
    const error1 = new Error('cause message');
    const error = new Error('error message', { cause: error1 });
    const errorData = { circularDependency: undefined };
    errorData.circularDependency = errorData as any;
    error1.cause = { errorData };

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe(
        'error message\nCaused by: cause message\nCaused by: [Circular reference in object]',
      );
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: Error: cause message');
    });
  });

  describe('cause is circular (triangular reference)', () => {
    const error1 = new Error('level 1 cause message');
    const error2 = new Error('level 2 cause message', { cause: error1 });
    const error = new Error('error message', { cause: error2 });
    error1.cause = error;

    it('returns the correct error message', () => {
      expect(ErrorFormatter.getMessage(error)).toBe(
        'error message\nCaused by: [Circular reference]',
      );
    });

    it('returns the correct stack trace', () => {
      expect(ErrorFormatter.getStack(error)).toContain('Error: error message');
      expect(ErrorFormatter.getStack(error)).toContain('Caused by: [Circular reference]');
    });
  });
});
