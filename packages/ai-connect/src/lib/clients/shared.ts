export function parseJsonText<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function fetchJson(
  url: string,
  init: RequestInit
): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI provider request failed (${response.status} ${response.statusText}): ${body}`
    );
  }
  return response.json();
}

export function isSchemaFormatError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('output_config') ||
    message.includes('output format') ||
    message.includes('output_format') ||
    message.includes('response schema') ||
    message.includes('responseschema') ||
    message.includes('response_schema')
  );
}
