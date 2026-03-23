import type {
  ContinuumExecutionFinalResult,
  StreamContinuumExecutionArgs,
} from '../types.js';
import { streamContinuumExecution } from './stream-continuum-execution.js';

export async function runContinuumExecution(
  args: StreamContinuumExecutionArgs
): Promise<ContinuumExecutionFinalResult> {
  const iterator = streamContinuumExecution(args);
  let next = await iterator.next();

  while (!next.done) {
    next = await iterator.next();
  }

  return next.value;
}
