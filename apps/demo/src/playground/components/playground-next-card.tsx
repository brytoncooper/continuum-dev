import type { CSSProperties } from 'react';
import { ExampleCard } from '../../ui/layout';
import { color, space, type } from '../../ui/tokens';

const listStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
};

const itemStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function PlaygroundNextCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <ExampleCard title={title} description={description} span={12}>
      <div style={listStyle}>
        {items.map((item) => (
          <div key={item} style={itemStyle}>
            {item}
          </div>
        ))}
      </div>
    </ExampleCard>
  );
}
