// Generated from the parts of packages/ui/src by packages/ui/build/parts.ts: do not edit. Add a
// part's X.tsx, X.css, X.meta.ts and X.specimen.tsx there and run `pnpm --filter @omni/ui parts`.

import type { Part } from '../meta.ts';
import { Badge } from '../Badge.tsx';
import { badgeMeta } from '../Badge.meta.ts';
import { badgeSpecimen } from '../Badge.specimen.tsx';
import { Button } from '../Button.tsx';
import { buttonMeta } from '../Button.meta.ts';
import { buttonSpecimen } from '../Button.specimen.tsx';
import { Card } from '../Card.tsx';
import { cardMeta } from '../Card.meta.ts';
import { cardSpecimen } from '../Card.specimen.tsx';
import { EmptyState } from '../EmptyState.tsx';
import { emptyStateMeta } from '../EmptyState.meta.ts';
import { emptyStateSpecimen } from '../EmptyState.specimen.tsx';
import { Icon } from '../Icon.tsx';
import { iconMeta } from '../Icon.meta.ts';
import { iconSpecimen } from '../Icon.specimen.tsx';
import { IconButton } from '../IconButton.tsx';
import { iconButtonMeta } from '../IconButton.meta.ts';
import { iconButtonSpecimen } from '../IconButton.specimen.tsx';
import { Link } from '../Link.tsx';
import { linkMeta } from '../Link.meta.ts';
import { linkSpecimen } from '../Link.specimen.tsx';
import { ListRow } from '../ListRow.tsx';
import { listRowMeta } from '../ListRow.meta.ts';
import { listRowSpecimen } from '../ListRow.specimen.tsx';
import { Notice } from '../Notice.tsx';
import { noticeMeta } from '../Notice.meta.ts';
import { noticeSpecimen } from '../Notice.specimen.tsx';
import { PageHeader } from '../PageHeader.tsx';
import { pageHeaderMeta } from '../PageHeader.meta.ts';
import { pageHeaderSpecimen } from '../PageHeader.specimen.tsx';
import { SegmentedControl } from '../SegmentedControl.tsx';
import { segmentedControlMeta } from '../SegmentedControl.meta.ts';
import { segmentedControlSpecimen } from '../SegmentedControl.specimen.tsx';
import { Stack } from '../Stack.tsx';
import { stackMeta } from '../Stack.meta.ts';
import { stackSpecimen } from '../Stack.specimen.tsx';
import { Tabs } from '../Tabs.tsx';
import { tabsMeta } from '../Tabs.meta.ts';
import { tabsSpecimen } from '../Tabs.specimen.tsx';
import { Text } from '../Text.tsx';
import { textMeta } from '../Text.meta.ts';
import { textSpecimen } from '../Text.specimen.tsx';

/** Every part's component, by its name. */
export const COMPONENTS = { Badge, Button, Card, EmptyState, Icon, IconButton, Link, ListRow, Notice, PageHeader, SegmentedControl, Stack, Tabs, Text } as const;

/** Every part: its meta (variants, usage, do, don't, contrast) and its specimen. */
export const PARTS: readonly Part[] = [
  { meta: badgeMeta, specimen: badgeSpecimen },
  { meta: buttonMeta, specimen: buttonSpecimen },
  { meta: cardMeta, specimen: cardSpecimen },
  { meta: emptyStateMeta, specimen: emptyStateSpecimen },
  { meta: iconMeta, specimen: iconSpecimen },
  { meta: iconButtonMeta, specimen: iconButtonSpecimen },
  { meta: linkMeta, specimen: linkSpecimen },
  { meta: listRowMeta, specimen: listRowSpecimen },
  { meta: noticeMeta, specimen: noticeSpecimen },
  { meta: pageHeaderMeta, specimen: pageHeaderSpecimen },
  { meta: segmentedControlMeta, specimen: segmentedControlSpecimen },
  { meta: stackMeta, specimen: stackSpecimen },
  { meta: tabsMeta, specimen: tabsSpecimen },
  { meta: textMeta, specimen: textSpecimen },
];
