/**
 * The worker threads of `npm run tas -- run`: `count` workers (`worker.ts`) take the jobs one
 * at a time. A job's progress and phase messages go to `onProgress`, its last message ('done'
 * or 'error') to `onResult`. A worker that dies (out of memory, a crash outside the job's own
 * try) reports its job as an error and is replaced, so the run never waits forever.
 */
import { Worker } from 'node:worker_threads';
import type { JobMessage, TasJob } from './job.ts';

type Progress = Extract<JobMessage, { type: 'progress' | 'phase' }>;
type Result = Extract<JobMessage, { type: 'done' | 'error' }>;

export async function runPool(
  jobs: readonly TasJob[],
  count: number,
  onProgress: (job: TasJob, m: Progress) => void,
  onResult: (job: TasJob, m: Result) => void,
): Promise<void> {
  const queue = jobs.slice();
  const spawn = (): Worker => new Worker(new URL('./worker.ts', import.meta.url));
  await Promise.all(
    Array.from({ length: Math.min(count, jobs.length) }, async () => {
      let worker = spawn();
      try {
        for (let job = queue.shift(); job; job = queue.shift()) {
          const { message, died } = await runOn(worker, job, onProgress);
          if (died) worker = spawn();
          onResult(job, message);
        }
      } finally {
        await worker.terminate();
      }
    }),
  );
}

function runOn(
  worker: Worker,
  job: TasJob,
  onProgress: (job: TasJob, m: Progress) => void,
): Promise<{ message: Result; died: boolean }> {
  return new Promise((resolve) => {
    const finish = (message: Result, died: boolean): void => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
      resolve({ message, died });
    };
    const failed = (error: string): Result => ({
      type: 'error',
      levelId: job.levelId,
      mode: job.mode,
      error,
    });
    const onMessage = (m: JobMessage): void => {
      if (m.type === 'progress' || m.type === 'phase') onProgress(job, m);
      else finish(m, false);
    };
    const onError = (error: Error): void => finish(failed(error.stack ?? error.message), true);
    const onExit = (code: number): void => finish(failed(`worker exited (code ${code})`), true);
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    worker.postMessage(job);
  });
}
