import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  Snackbar,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { api, StandingCropApi } from '../lib/api';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';
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
  progressTrackSx,
  progressFillSx,
} from '../styles/modernUi';

export function StandingCrop() {
  const { user } = useAuth();
  const { barangays: barangayList, getSitiosByBarangayName } = useLocations();
  const assignedBarangay = user?.role === 'technician' ? user.municipality || '' : '';
  const [reports, setReports] = useState<StandingCropApi[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<StandingCropApi | null>(null);
  const [formData, setFormData] = useState<Partial<StandingCropApi>>({});
  const [snack, setSnack] = useState('');

  const municipalities = ['Rizal'];
  const barangays = barangayList.map((b) => b.name);
  const availableSitios = formData.barangay ? getSitiosByBarangayName(formData.barangay) : [];

  const loadReports = useCallback(async () => {
    try {
      setReports(await api.getStandingCropReports());
    } catch {
      setSnack('Failed to load standing crop reports');
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const cropStages = ['Newly Planted', 'Vegetative', 'Reproductive', 'Maturing', 'Harvesting'];
  const cropConditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
  const pestInfestations = ['None', 'Mild', 'Moderate', 'Severe'];
  const irrigationStatuses = ['Normal', 'Low Water', 'Drought', 'Flooded'];

  const stageDistribution = cropStages.map((stage) => ({
    stage,
    count: reports.filter((r) => r.cropStage === stage).length,
  }));

  const totalDamaged = reports.reduce((sum, r) => sum + r.damagedArea, 0);
  const totalArea = reports.reduce((sum, r) => sum + r.area, 0);
  const maxStageCount = Math.max(...stageDistribution.map((s) => s.count), 1);
  const damagePct = totalArea > 0 ? (totalDamaged / totalArea) * 100 : 0;

  const handleAdd = () => {
    setEditingReport(null);
    setFormData({
      cropStage: 'Newly Planted',
      cropCondition: 'Good',
      pestInfestation: 'None',
      irrigationStatus: 'Normal',
      damagedArea: 0,
      municipality: 'Rizal',
      ...(assignedBarangay ? { barangay: assignedBarangay } : {}),
    });
    setDialogOpen(true);
  };

  const handleEdit = (report: StandingCropApi) => {
    setEditingReport(report);
    setFormData(report);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this standing crop report?')) return;
    try {
      await api.deleteStandingCropReport(id);
      await loadReports();
      setSnack('Report deleted');
    } catch {
      setSnack('Delete failed');
    }
  };

  const handleSave = async () => {
    if (!formData.barangay) {
      setSnack('Please select a barangay');
      return;
    }
    try {
      const payload = {
        municipality: formData.municipality || 'Rizal',
        barangay: formData.barangay,
        sitio: formData.sitio || '-',
        cropStage: formData.cropStage || 'Newly Planted',
        area: formData.area || 0,
        cropCondition: formData.cropCondition || 'Good',
        damagedArea: formData.damagedArea ?? 0,
        pestInfestation: formData.pestInfestation || 'None',
        irrigationStatus: formData.irrigationStatus || 'Normal',
      };
      if (editingReport) {
        await api.updateStandingCropReport(editingReport.id, payload);
      } else {
        await api.createStandingCropReport(payload);
      }
      setDialogOpen(false);
      await loadReports();
      setSnack(editingReport ? 'Report updated' : 'Report saved');
    } catch {
      setSnack('Save failed');
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Excellent':
      case 'Good':
        return 'success';
      case 'Fair':
        return 'warning';
      case 'Poor':
      case 'Critical':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={pageShellSx}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />

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
        <Box sx={{ maxWidth: 640 }}>
          <Typography variant="h4" sx={pageTitleSx}>
            Standing Crop Monitoring
          </Typography>
          <Typography sx={pageSubtitleSx}>
            Monitor rice crop stages and field conditions across Rizal, Palawan
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAdd}
          sx={{
            px: 2.5,
            py: 1.25,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 'none',
            bgcolor: '#2e7d32',
            '&:hover': { bgcolor: '#1b5e20', boxShadow: 'none' },
          }}
        >
          Add Crop Report
        </Button>
      </Box>

      <Grid container spacing={{ xs: 2.5, md: 3.5 }} sx={sectionGapSx}>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <Card elevation={0} sx={modernCardSx}>
            <CardContent sx={modernCardContentSx}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.15rem',
                  color: '#111827',
                  mb: { xs: 3, md: 4 },
                }}
              >
                Crop Stage Distribution
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.75, md: 3.5 } }}>
                {stageDistribution.map((item) => (
                  <Box key={item.stage}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Typography sx={{ fontSize: '0.95rem', color: '#374151', fontWeight: 500 }}>
                        {item.stage}
                      </Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: '#111827', fontWeight: 600 }}>
                        {item.count} fields
                      </Typography>
                    </Box>
                    <Box sx={progressTrackSx}>
                      <Box sx={progressFillSx((item.count / maxStageCount) * 100)} />
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3.5 }, height: '100%' }}>
            <Card elevation={0} sx={{ ...modernCardSx, flex: 1 }}>
              <CardContent
                sx={{
                  ...modernCardContentSx,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: { md: 160 },
                }}
              >
                <Typography sx={metricLabelSx}>Total Monitored Area</Typography>
                <Typography sx={metricValueSx}>{totalArea.toFixed(2)}</Typography>
                <Typography sx={metricUnitSx}>hectares</Typography>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ ...modernCardSx, flex: 1 }}>
              <CardContent
                sx={{
                  ...modernCardContentSx,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: { md: 160 },
                }}
              >
                <Typography sx={metricLabelSx}>Total Damaged Area</Typography>
                <Typography
                  sx={{
                    ...metricValueSx,
                    color: totalDamaged > 0 ? '#c62828' : '#111827',
                  }}
                >
                  {totalDamaged.toFixed(2)}
                </Typography>
                <Typography sx={metricUnitSx}>
                  hectares ({damagePct.toFixed(1)}%)
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      <TableContainer component={Paper} elevation={0} sx={{ ...modernCardSx, overflowX: 'auto' }}>
        <Box sx={{ px: { xs: 3, md: 4 }, pt: { xs: 3, md: 3.5 }, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>
            Field reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {reports.length} standing crop record{reports.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1', pl: { xs: 3, md: 4 } }}>
                Municipality
              </TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Barangay</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Sitio/Purok</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Crop Stage</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Area (ha)</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Condition</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Damaged (ha)</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Pest Status</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Irrigation</TableCell>
              <TableCell sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1' }}>Last Updated</TableCell>
              <TableCell align="right" sx={{ color: '#6b7280', borderBottomColor: '#f0f2f1', pr: { xs: 3, md: 4 } }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id} hover sx={{ '& td': { borderBottomColor: '#f5f6f5', py: 2 } }}>
                <TableCell sx={{ pl: { xs: 3, md: 4 } }}>{report.municipality}</TableCell>
                <TableCell>{report.barangay}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {report.sitio}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={report.cropStage} size="small" color="primary" variant="outlined" />
                </TableCell>
                <TableCell>{report.area}</TableCell>
                <TableCell>
                  <Chip
                    label={report.cropCondition}
                    size="small"
                    color={getConditionColor(report.cropCondition)}
                  />
                </TableCell>
                <TableCell>
                  {report.damagedArea > 0 ? (
                    <Typography color="error" fontWeight="bold">
                      {report.damagedArea}
                    </Typography>
                  ) : (
                    <Typography color="text.secondary">0</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={report.pestInfestation}
                    size="small"
                    color={report.pestInfestation === 'None' ? 'success' : 'warning'}
                  />
                </TableCell>
                <TableCell>{report.irrigationStatus}</TableCell>
                <TableCell>{new Date(report.lastUpdated).toLocaleDateString()}</TableCell>
                <TableCell align="right" sx={{ pr: { xs: 3, md: 4 } }}>
                  <IconButton size="small" onClick={() => handleEdit(report)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => void handleDelete(report.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {reports.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                  No standing crop reports yet — add a field report to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingReport ? 'Edit Standing Crop Report' : 'Add New Crop Monitoring Report'}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                label="Municipality"
                value={formData.municipality || ''}
                onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '150px' }}
              >
                {municipalities.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Barangay"
                value={formData.barangay || ''}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value, sitio: '' })}
                disabled={!!assignedBarangay}
                helperText={assignedBarangay ? 'Locked to your assigned barangay' : undefined}
                {...standardInputProps}
                sx={{ minWidth: '180px' }}
              >
                {barangays.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Sitio/Purok"
                value={formData.sitio || ''}
                onChange={(e) => setFormData({ ...formData, sitio: e.target.value })}
                disabled={!formData.barangay}
                {...standardInputProps}
                helperText="Optional"
                sx={{ minWidth: '150px' }}
              >
                <MenuItem value="-">Not Specified</MenuItem>
                {availableSitios.map((s) => (
                  <MenuItem key={s.id} value={s.name}>
                    {s.name} ({s.type})
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                label="Crop Stage"
                value={formData.cropStage || ''}
                onChange={(e) => setFormData({ ...formData, cropStage: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '180px' }}
              >
                {cropStages.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Total Area"
                type="number"
                value={formData.area || ''}
                onChange={(e) => setFormData({ ...formData, area: parseFloat(e.target.value) })}
                {...standardInputProps}
                helperText="in hectares"
                sx={{ minWidth: '200px', flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                label="Crop Condition"
                value={formData.cropCondition || ''}
                onChange={(e) => setFormData({ ...formData, cropCondition: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '160px' }}
              >
                {cropConditions.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Damaged Area"
                type="number"
                value={formData.damagedArea || 0}
                onChange={(e) =>
                  setFormData({ ...formData, damagedArea: parseFloat(e.target.value) })
                }
                {...standardInputProps}
                helperText="in hectares"
                sx={{ minWidth: '200px', flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                label="Pest Infestation"
                value={formData.pestInfestation || ''}
                onChange={(e) => setFormData({ ...formData, pestInfestation: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '180px' }}
              >
                {pestInfestations.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Irrigation Status"
                value={formData.irrigationStatus || ''}
                onChange={(e) => setFormData({ ...formData, irrigationStatus: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '180px' }}
              >
                {irrigationStatuses.map((i) => (
                  <MenuItem key={i} value={i}>
                    {i}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => void handleSave()}
            variant="contained"
            sx={{ bgcolor: '#2e7d32', boxShadow: 'none', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            {editingReport ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
