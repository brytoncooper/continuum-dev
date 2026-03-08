import type { ContinuumNodeMap } from '@continuum/react';
import {
  ActionButton,
  CollectionSection,
  DateInput,
  GridSection,
  GroupSection,
  Presentation,
  RadioGroupInput,
  RowSection,
  SelectInput,
  SliderInput,
  TextareaInput,
  TextInput,
  ToggleInput,
  UnknownNode,
} from './primitives/index.js';

export const starterKitComponentMap: ContinuumNodeMap = {
  field: TextInput,
  select: SelectInput,
  toggle: ToggleInput,
  date: DateInput,
  textarea: TextareaInput,
  'radio-group': RadioGroupInput,
  slider: SliderInput,
  action: ActionButton,
  presentation: Presentation,
  group: GroupSection,
  row: RowSection,
  grid: GridSection,
  collection: CollectionSection,
  default: UnknownNode,
};
