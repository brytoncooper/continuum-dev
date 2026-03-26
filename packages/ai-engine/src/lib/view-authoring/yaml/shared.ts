import { advanceContinuumViewVersion } from '@continuum-dev/protocol';
import type { PromptAddon } from '@continuum-dev/prompts';

export function bumpVersion(version: string): string {
  return advanceContinuumViewVersion(version, 'major');
}

export function uniqueAddons(addons: PromptAddon[] = []): PromptAddon[] {
  return Array.from(new Set(addons));
}
