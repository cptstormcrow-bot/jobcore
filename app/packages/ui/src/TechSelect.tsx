import React from 'react';
import { Select, SelectProps } from './Select';

// Field-tech picker: shows the heading "Choose a Field Tech" by default; callers may override `title`.
// Use this instead of plain Select for every tech picker (Jeff's 0.3.0 test 6.1, "global request").
export type TechSelectProps = SelectProps;

export function TechSelect({ title = 'Choose a Field Tech', ...rest }: TechSelectProps) {
  return <Select title={title} {...rest} />;
}
