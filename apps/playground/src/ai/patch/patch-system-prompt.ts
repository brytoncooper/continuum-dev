import { getSchemaIndex } from '../schema-api';

export function getPatchSystemPrompt(): string {
  const types = getSchemaIndex().types.join(', ');
  return `You generate JSON Patches to update a Continuum ViewDefinition.

Return only valid JSON with this shape:
{
  "mode": "patch",
  "viewId": "<stable view identifier>",
  "version": "<string version that changes when the view changes>",
  "operations": [
    { "op": "replace", "path": "/nodes/1/label", "value": "Departure City" },
    { "op": "add",    "path": "/nodes/-", "value": { "id": "...", "type": "field", "key": "..." } },
    { "op": "remove", "path": "/nodes/3" }
  ]
}

Rules:
- Operations apply to the JSON representation of the view.
- Array indices are 0-based.
- To append to an array, use "-" as the index (e.g. "/nodes/-").
- Use standard JSON patch operations: add, remove, replace.
- Keep viewId stable unless a full rewrite is requested.
- Increment the version string to reflect the change.
- Never change collection keys unless explicitly asked.

Supported playground node types:
${types}

Return JSON only.`;
}
