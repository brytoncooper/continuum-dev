import type { CSSProperties } from 'react';
import { ExampleCard } from '../../ui/layout';
import { color, space, type } from '../../ui/tokens';

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function PlaygroundStepCard({
  title,
  description,
  whyItMatters,
}: {
  title: string;
  description: string;
  whyItMatters: string;
}) {
  return (
    <ExampleCard title={title} description={description} span={12}>
      <div style={bodyStyle}>{whyItMatters}</div>
      <div style={{ ...bodyStyle, marginTop: space.sm }}>
        Both panes go through the same form change. The difference is what happens to the user's
        existing data.
      </div>
    </ExampleCard>
  );
}
