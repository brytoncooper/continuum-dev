# AI Integration Guide

How to connect an AI agent to Continuum so it can generate and evolve UIs while preserving user state.

---

## How It Works

```
AI Agent → generates SchemaSnapshot JSON → session.pushSchema(schema)
                                                    ↓
                                            Reconciliation runs
                                                    ↓
                                            User state preserved
```

The AI never interacts with Continuum directly. Your application receives the AI's output, formats it as a `SchemaSnapshot`, and pushes it into the session. Continuum handles the rest.

---

## What a Valid Schema Looks Like

### Minimum

```json
{
  "schemaId": "my-form",
  "version": "1",
  "components": [
    { "id": "name", "type": "input" },
    { "id": "email", "type": "input" }
  ]
}
```

### With State Preservation Keys

Add `key` fields so Continuum can match components even if the AI renames IDs:

```json
{
  "schemaId": "my-form",
  "version": "2",
  "components": [
    { "id": "full_name", "type": "input", "key": "name" },
    { "id": "email_address", "type": "input", "key": "email" },
    { "id": "phone", "type": "input", "key": "phone" }
  ]
}
```

Here `full_name` has `key: "name"`, so Continuum matches it to the prior `name` component and carries the user's input forward.

### With Nested Structure

```json
{
  "schemaId": "my-form",
  "version": "3",
  "components": [
    {
      "id": "personal",
      "type": "section",
      "key": "personal",
      "children": [
        { "id": "full_name", "type": "input", "key": "name" },
        { "id": "email_address", "type": "input", "key": "email" }
      ]
    },
    { "id": "agree", "type": "toggle", "key": "agree" }
  ]
}
```

---

## Schema Generation Prompt Template

Use this as a system prompt (or append to your existing one) to instruct the AI to produce Continuum-compatible schemas:

```
You generate UI schemas in JSON format. Each schema has this structure:

{
  "schemaId": "<stable form identifier>",
  "version": "<version string, increment on each change>",
  "components": [
    {
      "id": "<unique id for this version>",
      "type": "<component type>",
      "key": "<stable semantic key that persists across versions>"
    }
  ]
}

Rules:
- "schemaId" stays the same across all versions of the same form
- "version" must change whenever you modify the components
- "id" must be unique within the schema
- "key" should be a stable semantic identifier (e.g. "email", "first_name")
  that stays the same even if you rename or reorganize components
- "type" must be one of: input, textarea, select, toggle, date, slider,
  radio-group, section, container

For select/radio-group components, include options in "stateShape":
{
  "id": "country",
  "type": "select",
  "key": "country",
  "stateShape": [
    { "id": "us", "label": "United States" },
    { "id": "uk", "label": "United Kingdom" }
  ]
}

For section/container components, nest children:
{
  "id": "personal_info",
  "type": "section",
  "key": "personal",
  "children": [
    { "id": "name", "type": "input", "key": "name" },
    { "id": "email", "type": "input", "key": "email" }
  ]
}
```

---

## Sending Current Schema as Context

When asking the AI to modify an existing form, include the current schema so it can produce an evolution rather than a replacement:

```typescript
const snapshot = session.getSnapshot();

const messages = [
  {
    role: 'system',
    content: 'You generate UI schemas. [prompt template above]',
  },
  {
    role: 'user',
    content: `Here is the current form schema:\n\n${JSON.stringify(snapshot?.schema, null, 2)}\n\nPlease add a phone number field and organize the fields into sections.`,
  },
];
```

The AI sees the current IDs and keys and can produce a compatible evolution.

---

## Handling Schema Diffs After pushSchema

After pushing a new schema, inspect what happened:

```typescript
session.pushSchema(newSchemaFromAgent);

const trace = session.getTrace();
for (const entry of trace) {
  switch (entry.action) {
    case 'carried':
      // State preserved, matched by entry.matchedBy ('id' or 'key')
      break;
    case 'added':
      // New component, no prior state
      break;
    case 'migrated':
      // State was transformed via migration strategy
      break;
    case 'dropped':
      // State was lost (type mismatch or migration failure)
      console.warn(`State dropped for ${entry.componentId}`);
      break;
  }
}

const issues = session.getIssues();
const errors = issues.filter((i) => i.severity === 'error');
if (errors.length > 0) {
  console.error('Reconciliation errors:', errors);
}
```

### Feeding Diffs Back to the AI

You can send the diff summary back to the AI for self-correction:

```typescript
const issues = session.getIssues();
const dropped = session.getTrace().filter((t) => t.action === 'dropped');

if (dropped.length > 0) {
  const feedback = `The following components lost user data due to type changes: ${dropped.map((d) => d.componentId).join(', ')}. Please regenerate the schema keeping these as their original types.`;

  // Send feedback to the AI for the next iteration
}
```

---

## Error Handling for Invalid Schemas

### Missing Required Fields

If the AI omits `id` or `type`, components may not render or reconcile correctly. Validate before pushing:

```typescript
function validateSchema(schema: SchemaSnapshot): string[] {
  const errors: string[] = [];

  if (!schema.schemaId) errors.push('Missing schemaId');
  if (!schema.version) errors.push('Missing version');

  function validateComponents(components: ComponentDefinition[], path: string) {
    for (const comp of components) {
      if (!comp.id) errors.push(`Missing id at ${path}`);
      if (!comp.type) errors.push(`Missing type at ${path}/${comp.id ?? '?'}`);
      if (comp.children) {
        validateComponents(comp.children, `${path}/${comp.id}`);
      }
    }
  }

  validateComponents(schema.components, 'root');
  return errors;
}

const errors = validateSchema(schemaFromAgent);
if (errors.length > 0) {
  console.error('Invalid schema from AI:', errors);
  // Ask the AI to regenerate, or apply fixes
} else {
  session.pushSchema(schemaFromAgent);
}
```

### Duplicate IDs

Continuum indexes components by ID. Duplicate IDs cause the last one to win in the index, which leads to unpredictable state matching. Validate uniqueness:

```typescript
function findDuplicateIds(schema: SchemaSnapshot): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];

  function walk(components: ComponentDefinition[]) {
    for (const comp of components) {
      if (seen.has(comp.id)) dupes.push(comp.id);
      seen.add(comp.id);
      if (comp.children) walk(comp.children);
    }
  }

  walk(schema.components);
  return dupes;
}
```

---

## Example: OpenAI Structured Output

Use OpenAI's structured output (or function calling) to get well-formed schemas:

```typescript
import OpenAI from 'openai';
import type { SchemaSnapshot } from '@continuum/contract';

const client = new OpenAI();

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: `You produce UI form schemas as JSON. Output ONLY valid JSON matching this TypeScript interface:

interface SchemaSnapshot {
  schemaId: string;
  version: string;
  components: {
    id: string;
    type: "input" | "textarea" | "select" | "toggle" | "date" | "section";
    key: string;
    stateShape?: { id: string; label: string }[];
    children?: ComponentDefinition[];
  }[];
}`,
    },
    {
      role: 'user',
      content: 'Create a loan application form with personal info and loan details sections.',
    },
  ],
  response_format: { type: 'json_object' },
});

const schema = JSON.parse(response.choices[0].message.content!) as SchemaSnapshot;
session.pushSchema(schema);
```

### With Function Calling

```typescript
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'render_form',
      description: 'Render a dynamic form for the user',
      parameters: {
        type: 'object',
        required: ['schemaId', 'version', 'components'],
        properties: {
          schemaId: { type: 'string' },
          version: { type: 'string' },
          components: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'type', 'key'],
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['input', 'textarea', 'select', 'toggle', 'date', 'section'] },
                key: { type: 'string' },
                stateShape: { type: 'array', items: { type: 'object' } },
                children: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },
];

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
  tools,
});

const call = response.choices[0].message.tool_calls?.[0];
if (call?.function.name === 'render_form') {
  const schema = JSON.parse(call.function.arguments) as SchemaSnapshot;
  session.pushSchema(schema);
}
```

---

## Using the A2UI Adapter

If your AI agent natively speaks Google's A2UI protocol, use the built-in adapter:

```typescript
import { a2uiAdapter } from '@continuum/adapters';

function handleA2UIResponse(a2uiJson: A2UIForm) {
  const schema = a2uiAdapter.toSchema(a2uiJson);
  session.pushSchema(schema);
}
```

The adapter maps A2UI field types (`TextInput`, `Dropdown`, `Switch`, etc.) to Continuum component types. See the [adapters README](../packages/adapters/README.md) for the full mapping table.

---

## Best Practices

1. **Always include `key` fields** -- they're the primary mechanism for state preservation across schema changes. Without keys, Continuum can only match by `id`, which AIs tend to change.

2. **Keep `schemaId` constant** -- it identifies the logical form. Changing it makes the session treat it as an entirely new form.

3. **Increment `version`** -- this triggers checkpoint creation and pending action staling.

4. **Validate before pushing** -- catch invalid schemas before they reach the session.

5. **Send the current schema as context** -- this helps the AI produce compatible evolutions rather than replacements.

6. **Monitor dropped state** -- components with `dropped` trace action indicate the AI changed something incompatibly. Feed this back to the AI for correction.
