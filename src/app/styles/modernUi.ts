import { SxProps, Theme } from '@mui/material';

/** Soft off-white page canvas with breathing room (NRS modern UI). */
export const pageShellSx: SxProps<Theme> = {
  p: { xs: 2.5, sm: 3.5, md: 5 },
  maxWidth: 1400,
  mx: 'auto',
  minHeight: 'calc(100vh - 64px)',
};

export const pageTitleSx: SxProps<Theme> = {
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: '#1a1a1a',
  fontSize: { xs: '1.5rem', md: '1.85rem' },
};

export const pageSubtitleSx: SxProps<Theme> = {
  color: '#6b7280',
  mt: 0.75,
  mb: 0,
  fontSize: '0.95rem',
};

/** White elevated card — subtle border + soft shadow, generous padding. */
export const modernCardSx: SxProps<Theme> = {
  bgcolor: '#ffffff',
  borderRadius: 3,
  border: '1px solid rgba(15, 23, 42, 0.06)',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)',
  height: '100%',
};

export const modernCardContentSx: SxProps<Theme> = {
  p: { xs: 3, md: 4 },
  '&:last-child': { pb: { xs: 3, md: 4 } },
};

export const metricLabelSx: SxProps<Theme> = {
  color: '#6b7280',
  fontSize: '0.875rem',
  fontWeight: 500,
  mb: 1.5,
};

export const metricValueSx: SxProps<Theme> = {
  fontWeight: 700,
  fontSize: { xs: '2rem', md: '2.35rem' },
  letterSpacing: '-0.03em',
  color: '#111827',
  lineHeight: 1.15,
};

export const metricUnitSx: SxProps<Theme> = {
  color: '#9ca3af',
  fontSize: '0.8rem',
  mt: 1,
  display: 'block',
};

export const sectionGapSx: SxProps<Theme> = {
  mb: { xs: 3, md: 4 },
};

export const progressTrackSx: SxProps<Theme> = {
  height: 8,
  bgcolor: '#eef2f0',
  borderRadius: 999,
  overflow: 'hidden',
  mt: 1.25,
};

export const progressFillSx = (pct: number): SxProps<Theme> => ({
  height: '100%',
  width: `${Math.min(100, Math.max(0, pct))}%`,
  bgcolor: '#43a047',
  borderRadius: 999,
  transition: 'width 0.45s ease',
});
