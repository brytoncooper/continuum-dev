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

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    const opening = text[start];
    if (opening !== '{' && opening !== '[') {
      continue;
    }

    const stack = [opening === '{' ? '}' : ']'];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        stack.push('}');
        continue;
      }

      if (char === '[') {
        stack.push(']');
        continue;
      }

      if (char === '}' || char === ']') {
        const expected = stack.pop();
        if (expected !== char) {
          break;
        }
        if (stack.length === 0) {
          candidates.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates;
}

export function parseJson<T>(text: string): T | null {
  const candidates =
    stripCodeFences(text) === text ? [text] : [text, stripCodeFences(text)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      for (const extracted of extractJsonCandidates(candidate)) {
        try {
          return JSON.parse(extracted) as T;
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}
