import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, 'logs', 'vercel-ai-sdk-execution');

export async function writeVercelAiSdkExecutionLogFile(payload) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = Math.random().toString(36).slice(2, 10);
  const filePath = path.join(LOG_DIR, `execution-${stamp}-${id}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}
