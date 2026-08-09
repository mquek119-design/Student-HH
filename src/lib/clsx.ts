type ClassValue = string | number | null | undefined | false | ClassValue[];

/** Minimal class joiner — avoids a dependency for what is three lines of code. */
export function clsx(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = clsx(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(' ');
}
