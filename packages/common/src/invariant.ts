/**
 * Throws an error if the condition is falsy.
 * Useful for asserting critical assumptions during development.
 */
export function invariant(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
