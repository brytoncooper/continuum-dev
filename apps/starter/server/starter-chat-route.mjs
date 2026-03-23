import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

const modelId = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export default createContinuumVercelAiSdkRouteHandler({
  adapter: createVercelAiSdkContinuumExecutionAdapter({
    model: openai(modelId),
  }),
  defaultAuthoringFormat: 'line-dsl',
});
