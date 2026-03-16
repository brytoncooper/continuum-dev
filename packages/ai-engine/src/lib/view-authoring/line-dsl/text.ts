function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2 && lines[0].startsWith('```')) {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) {
    lines.pop();
  }

  return lines.join('\n').trim();
}

export function normalizeViewLineDslText(text: string): string {
  const stripped = stripCodeFences(text);
  const lines = stripped.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().startsWith('view '));

  return (startIndex >= 0 ? lines.slice(startIndex) : lines).join('\n').trim();
}

export function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z][\w-]*)=(?:"((?:\\.|[^"])*)"|([^\s]+))/g;
  let match: RegExpExecArray | null = regex.exec(input);

  while (match) {
    const key = match[1];
    const rawValue = match[2] ?? match[3] ?? '';
    attrs[key] = rawValue.replace(/\\"/g, '"');
    match = regex.exec(input);
  }

  return attrs;
}
