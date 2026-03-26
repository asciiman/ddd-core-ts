/**
 * Formats error messages and stack traces when those errors have causes. It relies on the `cause`
 * property of the Error class:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
 */
export class ErrorFormatter {
  /**
   * Checks if there is a circular reference between error and error.cause on all nesting levels
   * available.
   * @param error to check circular reference in.
   * @returns `true` if contains circular reference, `false` otherwise.
   */
  private static containsCircularReference(error: Error): boolean {
    const seen: Set<Error> = new Set();
    let current: Error | undefined = error;
    while (current) {
      if (seen.has(current)) {
        return true;
      }
      seen.add(current);
      current = current.cause instanceof Error ? current.cause : undefined;
    }
    return false;
  }

  /**
   * Calculates the message of the error. Includes the message of the error itself and the messages
   * of any error that caused this error, if available.
   * @param error to calculate message from.
   * @returns calculated stack or undefined if it's not available.
   */
  public static getMessage(error: Error): string {
    let causeMessage: string = '';
    if (this.containsCircularReference(error)) {
      causeMessage = '[Circular reference]';
    } else if (error.cause instanceof Error) {
      causeMessage = this.getMessage(error.cause);
    } else if (error.cause) {
      try {
        causeMessage = JSON.stringify(error.cause);
      } catch {
        causeMessage = '[Circular reference in object]';
      }
    }
    if (causeMessage.length > 0) {
      return `${error.message}\nCaused by: ${causeMessage}`;
    }
    return error.message;
  }

  /**
   * Calculates the stack trace of the error. Includes the stack trace of the error itself and the
   * stack traces of any error that caused this error, if available.
   * @param error to calculate stack from.
   * @returns calculated stack or undefined if it's not available.
   */
  public static getStack(error: Error): string | undefined {
    let causeStack: string | undefined;
    if (this.containsCircularReference(error)) {
      causeStack = '[Circular reference]';
    } else if (error.cause instanceof Error) {
      causeStack = this.getStack(error.cause);
    }
    if (causeStack && causeStack.length > 0) {
      return `${error.stack}\nCaused by: ${causeStack}`;
    }
    return error.stack;
  }
}
