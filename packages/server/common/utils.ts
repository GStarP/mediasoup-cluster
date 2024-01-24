/**
 * @param n raw number
 * @param decimal target decimal num
 * @returns fixed-decimal number
 */
export function numberReserve(n: number, decimal: number): number {
  return Number(Math.round(parseFloat(n + 'e' + decimal)) + 'e-' + decimal);
}

/**
 * @param e catchable
 * @returns readable error message
 */
export function toErrMessage(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  return `${e}`;
}

/**
 * @param e catchable
 * @returns full error info
 */
export function toErrString(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return `${e}`;
}

export function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return `${v}`;
    }
  }
  return `${v}`;
}
