import { normalizeViewLineDslText, parseAttrs } from './text.js';

describe('view line dsl text helpers', () => {
  it('drops leading prose and starts from the first view line', () => {
    expect(
      normalizeViewLineDslText(`Here is the next form:

view viewId="profile" version="2"
field id="email" dataType="string"`)
    ).toBe(`view viewId="profile" version="2"
field id="email" dataType="string"`);
  });

  it('strips surrounding markdown fences from a dsl block', () => {
    expect(
      normalizeViewLineDslText(`\`\`\`
view viewId="profile" version="2"
field id="email" dataType="string"
\`\`\``)
    ).toBe(`view viewId="profile" version="2"
field id="email" dataType="string"`);
  });

  it('parses quoted and unquoted attributes and unescapes embedded quotes', () => {
    expect(
      parseAttrs(
        'id="email" dataType=string defaultValue=true columns=2 content="Say \\"hello\\""'
      )
    ).toEqual({
      id: 'email',
      dataType: 'string',
      defaultValue: 'true',
      columns: '2',
      content: 'Say "hello"',
    });
  });
});
