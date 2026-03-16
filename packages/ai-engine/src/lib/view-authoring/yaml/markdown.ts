export function stripCodeFences(text: string): string {
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

export function extractMarkdownCodeBlock(
  text: string,
  languages: string[]
): string | null {
  const normalizedLanguages = languages.map((language) =>
    language.toLowerCase()
  );
  const lines = text.trim().split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim().toLowerCase();
    if (!line.startsWith('```')) {
      continue;
    }

    const language = line.slice(3).trim();
    if (
      normalizedLanguages.length > 0 &&
      !normalizedLanguages.includes(language)
    ) {
      continue;
    }

    const blockLines: string[] = [];
    for (let endIndex = index + 1; endIndex < lines.length; endIndex += 1) {
      if (lines[endIndex].trim().startsWith('```')) {
        return blockLines.join('\n').trim();
      }
      blockLines.push(lines[endIndex]);
    }
  }

  return null;
}
