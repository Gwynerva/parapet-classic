/** Sweeps: the same run tried with a press on every step of a range, and what each step gives. */

/** The steps `first..last` all give `value`. */
export type Band<V> = [first: number, last: number, value: V];

/** The runs of consecutive steps that give the same value, from `[step, value]` pairs in order. */
export function bands<V>(values: readonly (readonly [number, V])[]): Band<V>[] {
  const out: Band<V>[] = [];
  for (const [step, v] of values) {
    const last = out.at(-1);
    if (last && last[2] === v && last[1] === step - 1) last[1] = step;
    else out.push([step, step, v]);
  }
  return out;
}

/** `[first, last]` of the one band that gives `value`, or [] when there is not exactly one. */
export function onlyBand<V>(all: readonly Band<V>[], value: V): number[] {
  const b = all.filter(([, , v]) => v === value);
  return b.length === 1 ? [b[0]![0], b[0]![1]] : [];
}

/** `fn` of every step from `from` to `to`. */
export function sweep<T>(from: number, to: number, fn: (step: number) => T): T[] {
  const out: T[] = [];
  for (let s = from; s <= to; s++) out.push(fn(s));
  return out;
}
