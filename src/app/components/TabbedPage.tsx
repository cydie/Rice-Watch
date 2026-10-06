import { ReactNode, useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { pageSubtitleSx, pageTitleSx } from '../styles/modernUi';

export interface TabbedPageTab {
  label: string;
  render: () => ReactNode;
}

interface TabbedPageProps {
  title: string;
  subtitle?: string;
  tabs: TabbedPageTab[];
}

export function TabbedPage({ title, subtitle, tabs }: TabbedPageProps) {
  const [active, setActive] = useState(0);
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <Box>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 } }}>
        <Typography variant="h4" sx={pageTitleSx}>
          {title}
        </Typography>
        {subtitle && <Typography sx={pageSubtitleSx}>{subtitle}</Typography>}
        <Tabs
          value={active}
          onChange={(_, v: number) => setActive(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((t) => (
            <Tab key={t.label} label={t.label} />
          ))}
        </Tabs>
      </Box>
      <Box key={current.label}>{current.render()}</Box>
    </Box>
  );
}
