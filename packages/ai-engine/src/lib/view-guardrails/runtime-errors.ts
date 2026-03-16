export function buildRuntimeErrors(issues: unknown[]): string[] {
  return issues.map((issue) => {
    if (!issue || typeof issue !== 'object') {
      return String(issue);
    }

    const asRecord = issue as Record<string, unknown>;
    if (typeof asRecord.message === 'string') {
      return asRecord.message;
    }
    return JSON.stringify(issue);
  });
}
