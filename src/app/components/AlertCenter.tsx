import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Skeleton,
  Button,
  Chip,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Snackbar,
  Grid,
} from '@mui/material';
import { Download, NotificationAdd, WarningAmber } from '@mui/icons-material';
import { api, AlertsResponse, downloadBlob } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  pageShellSx,
  pageTitleSx,
  pageSubtitleSx,
  modernCardSx,
  sectionGapSx,
} from '../styles/modernUi';

const severityColor = (s: string) => {
  if (s === 'critical' || s === 'high') return 'error' as const;
  if (s === 'moderate') return 'warning' as const;
  if (s === 'low') return 'info' as const;
  return 'default' as const;
};

export function AlertCenter() {
  const { user } = useAuth();
  const canNotify = user?.role === 'admin' || user?.role === 'encoder';
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAlerts());
      setError('');
    } catch {
      setError('Failed to load early warnings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const syncNotifs = async () => {
    setBusy(true);
    try {
      const r = await api.syncAlertNotifications();
      setSnack(`Synced ${r.notified} high/critical notification(s)`);
      await load();
    } catch {
      setSnack('Failed to sync notifications');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await api.exportAlertsCsv();
      downloadBlob(blob, 'ricewatch-early-warnings.csv');
    } catch {
      setSnack('Export failed');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton height={40} width={260} />
        <Skeleton variant="rounded" height={320} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'No alert data'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={pageShellSx}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap', ...sectionGapSx }}>
        <Box sx={{ maxWidth: 640 }}>
          <Typography variant="h4" sx={pageTitleSx}>
            Early Warning Center
          </Typography>
          <Typography sx={pageSubtitleSx}>
            Standing-crop and harvest-lag risk scores for LGU / DA situationers.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Download />} onClick={() => void exportCsv()}>
            Export CSV
          </Button>
          {canNotify && (
            <Button
              variant="contained"
              startIcon={<NotificationAdd />}
              disabled={busy}
              onClick={() => void syncNotifs()}
              sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
            >
              Notify Department Head
            </Button>
          )}
        </Stack>
      </Box>

      <Grid container spacing={{ xs: 2.5, md: 3 }} sx={sectionGapSx}>
        {[
          { label: 'Critical', value: data.summary.critical, color: 'error' as const },
          { label: 'High', value: data.summary.high, color: 'error' as const },
          { label: 'Moderate', value: data.summary.moderate, color: 'warning' as const },
          { label: 'Low', value: data.summary.low, color: 'info' as const },
          { label: 'Barangays scored', value: data.summary.total, color: 'success' as const },
        ].map((c) => (
          <Grid key={c.label} size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{ ...modernCardSx, p: { xs: 2.5, md: 3 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {c.label}
              </Typography>
              <Typography variant="h4" fontWeight="bold" color={`${c.color}.main`} sx={{ letterSpacing: '-0.03em' }}>
                {c.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WarningAmber color="warning" />
          <Typography variant="h6" fontWeight="bold">
            Barangay risk table
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Barangay</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right">Damaged (ha)</TableCell>
              <TableCell align="right">Standing (ha)</TableCell>
              <TableCell>Flags</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.alerts.map((a) => (
              <TableRow key={a.barangay}>
                <TableCell>{a.barangay}</TableCell>
                <TableCell>
                  <Chip size="small" color={severityColor(a.severity)} label={a.severity} />
                </TableCell>
                <TableCell align="right">{a.score}</TableCell>
                <TableCell align="right">{a.damagedAreaHa}</TableCell>
                <TableCell align="right">{a.standingAreaHa}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {a.flags.join(' · ') || '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
