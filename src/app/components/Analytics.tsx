import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  MenuItem,
  TextField,
  Button,
  Skeleton,
  Alert,
  Snackbar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, Print, Science } from '@mui/icons-material';
import { api, AnalyticsData, downloadBlob } from '../lib/api';
import { printPage } from '../lib/exportUtils';
import { useAuth } from '../context/AuthContext';
import {
  pageShellSx,
  pageTitleSx,
  pageSubtitleSx,
  modernCardSx,
  sectionGapSx,
} from '../styles/modernUi';

export function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('production');
  const [snack, setSnack] = useState('');
  const [packBusy, setPackBusy] = useState(false);
  const assignedBarangay = user?.role === 'technician' ? user.municipality : null;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api
      .getAnalytics()
      .then(setData)
      .catch(() => setSnack('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    const typeMap: Record<string, string> = {
      production: 'production',
      planting: 'planting',
      harvest: 'harvest',
      standing: 'standing-crop',
    };
    try {
      const blob = await api.exportCsv(typeMap[reportType] || 'production');
      downloadBlob(blob, `ricewatch-${reportType}.csv`);
    } catch {
      setSnack('Export failed');
    }
  };

  const handleResearchPack = async () => {
    setPackBusy(true);
    try {
      const blob = await api.downloadResearchPack();
      downloadBlob(blob, 'RiceWatch-NRS-Rizal-DS2026-ResearchPack.xlsx');
      setSnack('NRS Research Pack downloaded');
    } catch {
      setSnack('Research pack export failed');
    } finally {
      setPackBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton height={48} width={300} />
        <Skeleton variant="rounded" height={400} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Unable to load analytics data</Alert>
      </Box>
    );
  }

  const {
    seasonalData,
    municipalityComparison,
    varietyDistribution,
    yieldTrends,
    irrigationSplit,
    researchMetrics,
    meta,
  } = data;

  return (
    <Box sx={pageShellSx} className="print-area">
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          ...sectionGapSx,
          flexWrap: 'wrap',
          gap: 3,
        }}
      >
        <Box sx={{ maxWidth: 720 }}>
          <Typography variant="h4" sx={pageTitleSx}>
            Analytics & Reports
          </Typography>
          <Typography sx={pageSubtitleSx}>
            {assignedBarangay
              ? `Barangay-scoped analytics for Brgy. ${assignedBarangay}`
              : `${meta.municipality}, ${meta.province} — research metrics from field reports`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Chip size="small" color="success" label={`Period: ${meta.dataPeriodLabel}`} />
            <Chip size="small" label={`Municipality: ${meta.municipality}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`${meta.recordCounts.planting} planting · ${meta.recordCounts.harvest} harvest · ${meta.recordCounts.standing} standing`}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Print />} onClick={printPage}>
            Print Report
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={() => void handleExport()}
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
          >
            Export Data
          </Button>
          {isAdmin && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Science />}
              disabled={packBusy}
              onClick={() => void handleResearchPack()}
            >
              NRS Research Pack
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={{ xs: 2.5, md: 3 }} sx={sectionGapSx}>
        {[
          { label: 'Mean yield', value: `${researchMetrics.meanYieldMtHa} MT/ha` },
          { label: 'Planted', value: `${researchMetrics.totalPlantedHa} ha` },
          { label: 'Harvested', value: `${researchMetrics.totalHarvestedHa} ha` },
          { label: 'Planted–harvest gap', value: `${researchMetrics.plantedVsHarvestedGapHa} ha` },
          { label: 'Production', value: `${researchMetrics.totalProductionMt} MT` },
          { label: 'Farmers (planting)', value: String(researchMetrics.totalFarmers) },
        ].map((m) => (
          <Grid key={m.label} size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper sx={{ ...modernCardSx, p: { xs: 2.5, md: 3 }, height: '100%' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {m.label}
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ letterSpacing: '-0.02em' }}>
                {m.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 }, mb: { xs: 3, md: 4 } }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              select
              label="Report Type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="production">Production Report</MenuItem>
              <MenuItem value="planting">Planting Report</MenuItem>
              <MenuItem value="harvest">Harvest Report</MenuItem>
              <MenuItem value="standing">Standing Crop</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={{ xs: 2.5, md: 3.5 }}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Seasonal Production — {meta.municipality}, {meta.province}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Aggregated from planting season labels and harvest totals in the database (not synthetic years).
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={seasonalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="season" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="planted" fill="#2196f3" name="Planted Area (ha)" />
                <Bar yAxisId="left" dataKey="harvested" fill="#4caf50" name="Harvested Area (ha)" />
                <Bar yAxisId="right" dataKey="production" fill="#ff9800" name="Production (MT)" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Barangay Ranking (by planted area)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={municipalityComparison.slice(0, 11)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="planted" fill="#2196f3" name="Planted (ha)" />
                <Bar yAxisId="left" dataKey="harvested" fill="#4caf50" name="Harvested (ha)" />
                <Bar yAxisId="right" dataKey="yield" fill="#ff9800" name="Yield (MT/ha)" />
              </BarChart>
            </ResponsiveContainer>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Barangay</TableCell>
                  <TableCell align="right">Farmers</TableCell>
                  <TableCell align="right">Gap (ha)</TableCell>
                  <TableCell align="right">Yield</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {municipalityComparison.slice(0, 11).map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell align="right">{r.farmers ?? '—'}</TableCell>
                    <TableCell align="right">{r.areaGapHa ?? '—'}</TableCell>
                    <TableCell align="right">{r.yield} MT/ha</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Variety Distribution (normalized)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={varietyDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {varietyDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Yield by Harvest Period (YYYY-MM)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Real monthly aggregates from harvest dates — empty if no harvest rows exist.
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yieldTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgYield"
                  stroke="#4caf50"
                  strokeWidth={3}
                  name="Average Yield (MT/ha)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Irrigation Split
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={irrigationSplit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="planted" fill="#2196f3" name="Planted (ha)" />
                <Bar dataKey="harvested" fill="#4caf50" name="Harvested (ha)" />
                <Bar dataKey="yield" fill="#ff9800" name="Yield (MT/ha)" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
