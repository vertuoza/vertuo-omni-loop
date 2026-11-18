import { Card } from './Card.tsx';
import { Grid } from './Grid.tsx';
import { GRID_COLUMNS, GRID_GAPS } from './Grid.meta.ts';
import { Text } from './Text.tsx';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Grid of cards at each number of columns and each gap. */
export const gridSpecimen: Specimen = (prop, value) => (
  <Grid
    {...(prop === 'columns' ? { columns: one(GRID_COLUMNS, value) } : {})}
    {...(prop === 'gap' ? { gap: one(GRID_GAPS, value) } : {})}
  >
    <Card padding="3"><Text as="span" size="small">One</Text></Card>
    <Card padding="3"><Text as="span" size="small">Two</Text></Card>
    <Card padding="3"><Text as="span" size="small">Three</Text></Card>
    <Card padding="3"><Text as="span" size="small">Four</Text></Card>
  </Grid>
);
