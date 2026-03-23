import type { ViewDefinition } from '@continuum-dev/core';
import { parseViewLineDslToViewDefinition } from './parser.js';

describe('parseViewLineDslToViewDefinition', () => {
  it('passes through complete json view definitions', () => {
    const view: ViewDefinition = {
      viewId: 'profile',
      version: '2',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          children: [],
        },
      ],
    };

    expect(
      parseViewLineDslToViewDefinition({
        text: JSON.stringify(view),
      })
    ).toEqual(view);
  });

  it('sanitizes streamed-json quote artifacts in json view definitions', () => {
    const text = JSON.stringify({
      viewId: '"invoice_entry_form',
      version: '1',
      nodes: [
        {
          id: 'root',
          type: 'group',
          children: [],
        },
      ],
    });

    expect(parseViewLineDslToViewDefinition({ text })).toEqual({
      viewId: 'invoice_entry_form',
      version: '1',
      nodes: [
        {
          id: 'root',
          type: 'group',
          children: [],
        },
      ],
    });
  });

  it('parses nested dsl into a view definition and bumps fallback metadata when omitted', () => {
    const fallbackView: ViewDefinition = {
      viewId: 'profile',
      version: '7',
      nodes: [],
    };

    const parsed = parseViewLineDslToViewDefinition({
      text: `\`\`\`
view note="draft"
group id="profile_root" label="Profile"
  row id="name_row"
    field id="first_name" key="first_name" label="First name" dataType="string"
    field id="age" key="age" label="Age" dataType="number" defaultValue=42
  collection id="medications" key="medications" label="Medications"
    group id="medication_item" label="Medication"
      field id="medication_name" key="medication_name" label="Medication name" dataType="string" defaultValue="Lisinopril"
action id="submit_profile"
\`\`\``,
      fallbackView,
    });

    expect(parsed).toMatchObject({
      viewId: 'profile',
      version: '8',
      nodes: [
        {
          id: 'profile_root',
          type: 'group',
          label: 'Profile',
          children: [
            {
              id: 'name_row',
              type: 'row',
              children: [
                {
                  id: 'first_name',
                  type: 'field',
                  key: 'first_name',
                },
                {
                  id: 'age',
                  type: 'field',
                  key: 'age',
                  defaultValue: 42,
                },
              ],
            },
            {
              id: 'medications',
              type: 'collection',
              key: 'medications',
              defaultValues: [{ medication_name: 'Lisinopril' }],
            },
          ],
        },
        {
          id: 'submit_profile',
          type: 'action',
          intentId: 'submit_profile.submit',
          label: 'Submit',
        },
      ],
    });
  });

  it('returns null when the input does not start with a view root', () => {
    expect(
      parseViewLineDslToViewDefinition({
        text: 'field id="email" dataType="string"',
      })
    ).toBeNull();
  });

  it('returns null when it encounters an unsupported node type', () => {
    expect(
      parseViewLineDslToViewDefinition({
        text: `view viewId="profile" version="1"
unknown id="bad_node"`,
      })
    ).toBeNull();
  });
});
