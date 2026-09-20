import { useCallback, useEffect, useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Skeleton,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Agriculture,
  Landscape,
  TrendingUp,
  People,
  Grass,
  WarningAmber,
  Sync,
  Speed,
} from '@mui/icons-material';
import { api, DashboardData } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  pageShellSx,
  pageTitleSx,
  pageSubtitleSx,
  modernCardSx,
  modernCardContentSx,
  metricLabelSx,
  metricValueSx,
  metricUnitSx,
  sectionGapSx,
} from '../styles/modernUi';

function formatSyncedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (isSync = false) => {
    if (isSync) setSyncing(true);
    else setLoading(true);
    setError('');
    try {
      const next = await api.getDashboard();
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  if (loading && !data) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Skeleton variant="text" width={320} height={48} />
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <Skeleton variant="rounded" height={110} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if ((error && !data) || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void loadDashboard(true)}>
              Retry
            </Button>
          }
        >
          {error || 'No data'}
        </Alert>
      </Box>
    );
  }

  const kpiCards = [
    {
      title: 'Planted Area',
      value: data.summary.totalPlantedArea.toLocaleString(),
      unit: 'hectares',
      icon: <Agriculture sx={{ fontSize: 36 }} />,
      color: '#4caf50',
    },
    {
      title: 'Harvested Area',
      value: data.summary.totalHarvestedArea.toLocaleString(),
      unit: 'hectares',
      icon: <Landscape sx={{ fontSize: 36 }} />,
      color: '#2196f3',
    },
    {
      title: 'Production',
      value: data.summary.totalProduction.toLocaleString(),
      unit: 'metric tons',
      icon: <TrendingUp sx={{ fontSize: 36 }} />,
      color: '#ff9800',
    },
    {
      title: 'Avg Yield',
      value: data.summary.averageYield.toLocaleString(),
      unit: 'MT / ha',
      icon: <Speed sx={{ fontSize: 36 }} />,
      color: '#00897b',
    },
    {
      title: 'Farmers',
      value: data.summary.farmerCount.toLocaleString(),
      unit: 'registered',
      icon: <People sx={{ fontSize: 36 }} />,
      color: '#5c6bc0',
    },
    {
      title: 'Standing Area',
      value: data.summary.standingArea.toLocaleString(),
      unit: 'hectares',
      icon: <Grass sx={{ fontSize: 36 }} />,
      color: '#8bc34a',
    },
  ];

  const topBarangays = data.topBarangays?.length
    ? data.topBarangays
    : data.topMunicipalities || [];

  const coverageTotal =
    data.coverage.planted || data.coverage.harvested + data.coverage.standing || 1;

  const isTechnician = user?.role === 'technician';
  const assignedBarangay = data.scope?.barangay || user?.municipality || null;

  return (
    <Box sx={pageShellSx}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 3,
          flexWrap: 'wrap',
          ...sectionGapSx,
        }}
      >
        <Box sx={{ maxWidth: 720 }}>
          <Typography variant="h4" sx={pageTitleSx}>
            {isTechnician ? 'Barangay Field Briefing' : 'Operations Briefing'}
          </Typography>
          <Typography sx={pageSubtitleSx}>
            {isTechnician && assignedBarangay
              ? `Assigned barangay: ${assignedBarangay} — data shown is limited to this area only`
              : 'RiceWatch department head overview — Rizal, Palawan'}
          </Typography>
          {isTechnician && assignedBarangay && (
            <Chip
              size="small"
              color="success"
              label={`Brgy. ${assignedBarangay}`}
              sx={{ mt: 1.5 }}
            />
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Last synced: {formatSyncedAt(data.lastSyncedAt)}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={18} color="inherit" /> : <Sync />}
          onClick={() => void loadDashboard(true)}
          disabled={syncing}
          sx={{ bgcolor: '#2e7d32', px: 2.5, py: 1.25, '&:hover': { bgcolor: '#1b5e20' } }}
        >
          {syncing ? 'Syncing…' : 'Sync data'}
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError('')}>
          Sync issue: {error}. Showing last loaded data.
        </Alert>
      )}

      <Grid container spacing={{ xs: 2.5, md: 3 }}>
        {kpiCards.map((item) => (
          <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Card elevation={0} sx={modernCardSx}>
              <CardContent sx={{ ...modernCardContentSx, py: { xs: 2.5, md: 3 } }}>
                <Typography sx={{ ...metricLabelSx, mb: 1.25 }}>{item.title}</Typography>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.65rem', md: '1.85rem' },
                    letterSpacing: '-0.03em',
                    color: '#111827',
                    lineHeight: 1.15,
                  }}
                >
                  {item.value}
                </Typography>
                <Typography sx={metricUnitSx}>{item.unit}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 }, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
              Harvest Coverage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {data.summary.harvestCoveragePct}% of planted area harvested ·{' '}
              {data.coverage.standing.toLocaleString()} ha still standing
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Harvested</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {data.coverage.harvested.toLocaleString()} ha
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (data.coverage.harvested / coverageTotal) * 100)}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  mb: 2.5,
                  bgcolor: '#eef2f0',
                  '& .MuiLinearProgress-bar': { bgcolor: '#43a047', borderRadius: 999 },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Still standing (est.)</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {data.coverage.standing.toLocaleString()} ha
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (data.coverage.standing / coverageTotal) * 100)}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  bgcolor: '#eef2f0',
                  '& .MuiLinearProgress-bar': { bgcolor: '#66bb6a', borderRadius: 999 },
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Planted base: {data.coverage.planted.toLocaleString()} ha
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 }, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <WarningAmber color="warning" />
              <Typography variant="h6" fontWeight="bold">
                Field Risk Alerts
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#fff8e1', borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight="bold" color="warning.dark">
                    {data.risks.damagedArea}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Damaged ha
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#fce4ec', borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    {data.risks.pestAlertCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pest reports
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#e3f2fd', borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight="bold" color="info.dark">
                    {data.risks.irrigationIssues}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Irrigation stress
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Based on latest standing crop monitoring across barangays.
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {isTechnician ? 'Barangay Summary' : 'Barangay Scoreboard'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {isTechnician && assignedBarangay
                ? `Production and area for Brgy. ${assignedBarangay}`
                : 'Production and area performance by barangay'}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Barangay</TableCell>
                    <TableCell align="right">Planted (ha)</TableCell>
                    <TableCell align="right">Harvested (ha)</TableCell>
                    <TableCell align="right">Production (MT)</TableCell>
                    <TableCell align="right">Standing (ha)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.barangayScoreboard.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No barangay activity yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.barangayScoreboard.map((row) => (
                      <TableRow key={row.name} hover>
                        <TableCell>
                          <Chip size="small" label={row.name} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{row.planted.toLocaleString()}</TableCell>
                        <TableCell align="right">{row.harvested.toLocaleString()}</TableCell>
                        <TableCell align="right">{row.production.toLocaleString()}</TableCell>
                        <TableCell align="right">{row.standing.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Monthly Production Trends
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyProductionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="production"
                  stroke="#4caf50"
                  strokeWidth={2}
                  name="Production (MT)"
                />
                <Line yAxisId="right" type="monotone" dataKey="area" stroke="#2196f3" strokeWidth={2} name="Area (ha)" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Top Producing Barangays
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topBarangays} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={90} />
                <Tooltip />
                <Bar dataKey="production" fill="#2196f3" name="Production (MT)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Crop Stage Mix
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.cropStageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" angle={-12} textAnchor="end" height={70} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4caf50" name="Fields" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 }, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Recent Field Activity
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              {data.recentActivities.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recent submissions
                </Typography>
              ) : (
                data.recentActivities.map((activity, index) => (
                  <Box
                    key={`${activity.action}-${index}`}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1,
                      p: 1.5,
                      bgcolor: '#fff',
                      borderRadius: 2,
                      borderLeft: '4px solid #4caf50',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="500">
                        {activity.action}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {activity.location}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {activity.time}
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
