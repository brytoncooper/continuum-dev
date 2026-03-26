export function createExecutionTraceId(): string {
  const cryptoApi = (globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  const randomUuid = cryptoApi?.randomUUID;
  if (typeof randomUuid === 'function') {
    return randomUuid.call(cryptoApi);
  }

  return `trace-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
