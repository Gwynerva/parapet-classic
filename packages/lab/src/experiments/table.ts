/**
 * The move table read as a whole: which shared transition lists each state falls back on, what
 * enters each state, what the start can reach, which transitions can never fire, which states
 * take no time. Computed from the original's table alone (`moves.json`).
 */
import type { MoveDef, MoveTransition } from '@parapet/sim';

/** The states that start a run: 0 after a crash, 2 when a level is loaded. */
export const ROOTS = [0, 2];

/** A state's transitions in the order they are tried: its own, then each parent's. */
export function effectiveTransitions(
  states: readonly MoveDef[],
  id: number,
): (MoveTransition & { owner: number })[] {
  const out: (MoveTransition & { owner: number })[] = [];
  for (let s = id; s >= 0; s = states[s]!.parent) {
    out.push(...states[s]!.transitions.map((t) => ({ ...t, owner: s })));
  }
  return out;
}

/** The states some transition or timer of the table enters. */
export function enteredByTable(states: readonly MoveDef[]): Set<number> {
  const out = new Set<number>();
  for (const s of states) {
    for (const t of s.transitions) out.add(t.target);
    if (s.next >= 0) out.add(s.next);
  }
  return out;
}

/** The states reachable from `roots` through transitions (parents' included) and timers. */
export function reachable(
  states: readonly MoveDef[],
  roots: readonly number[] = ROOTS,
): Set<number> {
  const seen = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const next = states[id]!.next;
    for (const to of [...effectiveTransitions(states, id).map((t) => t.target), next]) {
      if (to < 0 || seen.has(to)) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}

export interface Shadowed {
  /** The state whose list it is. */
  state: number;
  hidden: MoveTransition;
  /** An earlier transition of the list that holds whenever `hidden`'s conditions do. */
  by: MoveTransition;
}

/** Transitions that can never fire: an earlier one of their list asks for less. */
export function shadowedTransitions(states: readonly MoveDef[]): Shadowed[] {
  const out: Shadowed[] = [];
  for (const s of states) {
    s.transitions.forEach((t, j) => {
      const by = s.transitions
        .slice(0, j)
        .find((a) => a.conditions.every((c) => t.conditions.includes(c)));
      if (by) out.push({ state: s.id, hidden: t, by });
    });
  }
  return out;
}

/** States of no duration with a next state: left again within the step they are entered on. */
export function instantStates(states: readonly MoveDef[]): number[] {
  return states.filter((s) => s.duration === 0 && s.next >= 0).map((s) => s.id);
}

/** Which shared list a state falls back on, or whether it is only a shared list itself. */
export type Family = 'ground' | 'air' | 'other' | 'own' | 'list';

export function familyOf(
  states: readonly MoveDef[],
  entered: ReadonlySet<number>,
  id: number,
): Family {
  if (!entered.has(id) && states.some((s) => s.parent === id)) return 'list';
  const parents: number[] = [];
  for (let s = states[id]!.parent; s >= 0; s = states[s]!.parent) parents.push(s);
  if (parents.includes(1)) return 'ground';
  if (parents.includes(9)) return 'air';
  return parents.length > 0 ? 'other' : 'own';
}

/** The packed condition word of a transition: up to four condition ids, one per byte. */
export function conditionWord(t: MoveTransition): number {
  return t.conditions.reduce((w, c, i) => w | (c << (8 * i)), 0) >>> 0;
}
