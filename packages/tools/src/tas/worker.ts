/** Worker thread of `npm run tas -- run`: takes jobs one at a time and posts back messages. */
import { parentPort } from 'node:worker_threads';
import { runJob, type JobMessage, type TasJob } from './job.ts';

const port = parentPort;
if (!port) throw new Error('tas worker: no parent port');

port.on('message', (job: TasJob) => {
  const post = (m: JobMessage): void => port.postMessage(m);
  try {
    const run = runJob(job, post);
    post({ type: 'done', levelId: job.levelId, mode: job.mode, run });
  } catch (error) {
    post({
      type: 'error',
      levelId: job.levelId,
      mode: job.mode,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }
});
