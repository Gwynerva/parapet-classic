/**
 * Command line tools.
 *
 *   node src/cli.ts verify-replay <file.json>
 *
 * Replays a `RunSubmission` saved as JSON and prints the verdict together with the claimed and
 * computed values. Exit code 0 when the run verifies, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { SIM_VERSION } from '@parapet/sim';
import { validateSubmission, type RunClaim, type RunSubmission } from '@parapet/protocol';
import { replaySubmission, verifyRun } from './verify.ts';

function usage(): never {
  console.error('usage: node src/cli.ts verify-replay <file.json>');
  process.exit(2);
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readSubmission(file: string): RunSubmission {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    return fail(`cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(`${file} is not valid JSON`);
  }
  const validation = validateSubmission(parsed);
  if (!validation.ok) return fail(`${file} is not a valid submission: ${validation.error}`);
  return validation.value;
}

function printComparison(claimed: RunClaim, computed: RunClaim | null): void {
  const fields: (keyof RunClaim)[] = ['finished', 'timeUp', 'time', 'score', 'steps', 'hash'];
  console.log(`${'field'.padEnd(10)} ${'claimed'.padStart(12)} ${'computed'.padStart(12)}`);
  for (const field of fields) {
    const a = String(claimed[field]);
    const b = computed ? String(computed[field]) : '-';
    const mark = computed && a !== b ? '  <-- differs' : '';
    console.log(`${field.padEnd(10)} ${a.padStart(12)} ${b.padStart(12)}${mark}`);
  }
}

function verifyReplay(file: string): number {
  const submission = readSubmission(file);
  const rival = submission.mode === 'sprint' && submission.withRival ? 'with rival' : 'no rival';
  let steps = 0;
  for (const run of submission.input) steps += run.ticks;
  console.log(
    `replay: level ${submission.levelId} ${submission.mode}, ${rival}, player "${submission.playerName}" (character ${submission.character}), ${submission.input.length} input runs covering ${steps} steps`,
  );
  console.log(`sim: client ${submission.simVersion}, server ${SIM_VERSION}`);

  const verdict = verifyRun(submission);
  let computed: RunClaim | null = verdict.ok ? verdict.computed : (verdict.computed ?? null);
  if (!computed) {
    // The verdict was reached before replaying (unsupported mode or version); replay anyway so
    // the numbers are available for debugging.
    try {
      computed = replaySubmission(submission);
    } catch (err) {
      console.log(`replay failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  printComparison(submission.claimed, computed);
  if (verdict.ok) {
    const c = verdict.computed;
    console.log(
      `verdict: OK - finished in ${c.time} ms with ${c.score} points (${c.steps} steps, hash ${c.hash})`,
    );
    return 0;
  }
  console.log(`verdict: ${verdict.code.toUpperCase()} - ${verdict.error}`);
  return 1;
}

const [command, file] = process.argv.slice(2);
if (command !== 'verify-replay' || file === undefined) usage();
process.exit(verifyReplay(file));
