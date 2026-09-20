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
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Autocomplete,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Download,
  Assessment,
  TrendingUp
} from '@mui/icons-material';
import { api, HarvestReportApi, downloadBlob } from '../lib/api';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';
import { RICE_VARIETY_NAMES, normalizeRiceVariety } from '../lib/riceVarieties';

export function HarvestReports() {
  const { user } = useAuth();
  const { barangays: barangayList, getSitiosByBarangayName } = useLocations();
  const assignedBarangay = user?.role === 'technician' ? user.municipality || '' : '';
  const [reports, setReports] = useState<HarvestReportApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<HarvestReportApi | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<HarvestReportApi>>({});
  const [snack, setSnack] = useState('');

  const municipalities = ['Rizal'];
  const barangays = barangayList.map((b) => b.name);
  const availableSitios = formData.barangay ? getSitiosByBarangayName(formData.barangay) : [];

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await api.getHarvestReports());
    } catch {
      setSnack('Failed to load harvest reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);
  const irrigationTypes = ['Irrigated', 'Rainfed', 'Upland'];

  const totalHarvestedArea = reports.reduce((sum, r) => sum + r.harvestedArea, 0);
  const totalProduction = reports.reduce((sum, r) => sum + r.totalProduction, 0);
  const averageYield = totalProduction / totalHarvestedArea;

  const handleAdd = () => {
    setEditingReport(null);
    setFormData({
      irrigationType: 'Irrigated',
      municipality: 'Rizal',
      ...(assignedBarangay ? { barangay: assignedBarangay } : {}),
    });
    setDialogOpen(true);
  };

  const handleEdit = (report: HarvestReportApi) => {
    setEditingReport(report);
    setFormData(report);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this harvest report?')) return;
    try {
      await api.deleteHarvestReport(id);
      await loadReports();
      setSnack('Report deleted');
    } catch {
      setSnack('Delete failed');
    }
  };

  const handleSave = async () => {
    if (!formData.barangay || !formData.riceVariety) {
      setSnack('Please fill required fields');
      return;
    }
    try {
      const payload = {
        municipality: formData.municipality || 'Rizal',
        barangay: formData.barangay,
        sitio: formData.sitio || '-',
        harvestDate: formData.harvestDate || new Date().toISOString().split('T')[0],
        harvestedArea: formData.harvestedArea || 0,
        totalProduction: formData.totalProduction || 0,
        riceVariety: normalizeRiceVariety(formData.riceVariety || ''),
        irrigationType: formData.irrigationType || 'Irrigated',
      };
      if (editingReport) {
        await api.updateHarvestReport(editingReport.id, payload);
      } else {
        await api.createHarvestReport(payload);
      }
      setDialogOpen(false);
      await loadReports();
      setSnack(editingReport ? 'Report updated' : 'Report saved');
    } catch {
      setSnack('Save failed');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportCsv('harvest');
      downloadBlob(blob, 'harvest-reports.csv');
    } catch {
      setSnack('Export failed');
    }
  };

  const filteredReports = reports.filter(r =>
    r.municipality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.barangay.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Harvest Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track rice harvest data and production analytics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Download />} onClick={() => void handleExport()}>
            Export Report
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={handleAdd}
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}>
            Add Harvest Record
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #2196f315 0%, #2196f330 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Harvested Area</Typography>
                  <Typography variant="h4" fontWeight="bold">{totalHarvestedArea.toFixed(2)}</Typography>
                  <Typography variant="caption">hectares</Typography>
                </Box>
                <Assessment sx={{ fontSize: 40, color: '#2196f3' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf5015 0%, #4caf5030 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Production</Typography>
                  <Typography variant="h4" fontWeight="bold">{totalProduction.toFixed(2)}</Typography>
                  <Typography variant="caption">metric tons</Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #ff980015 0%, #ff980030 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Average Yield</Typography>
                  <Typography variant="h4" fontWeight="bold">{averageYield.toFixed(2)}</Typography>
                  <Typography variant="caption">MT/hectare</Typography>
                </Box>
                <Assessment sx={{ fontSize: 40, color: '#ff9800' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          placeholder="Search by municipality or barangay..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>Municipality</TableCell>
              <TableCell>Barangay</TableCell>
              <TableCell>Sitio/Purok</TableCell>
              <TableCell>Harvest Date</TableCell>
              <TableCell>Area (ha)</TableCell>
              <TableCell>Production (MT)</TableCell>
              <TableCell>Yield (MT/ha)</TableCell>
              <TableCell>Rice Variety</TableCell>
              <TableCell>Irrigation</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredReports.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell>{report.municipality}</TableCell>
                <TableCell>{report.barangay}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{report.sitio}</Typography>
                </TableCell>
                <TableCell>{new Date(report.harvestDate).toLocaleDateString()}</TableCell>
                <TableCell>{report.harvestedArea}</TableCell>
                <TableCell>{report.totalProduction}</TableCell>
                <TableCell>
                  <Chip
                    label={report.averageYield.toFixed(2)}
                    size="small"
                    color={report.averageYield >= 5 ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>{report.riceVariety}</TableCell>
                <TableCell>
                  <Chip label={report.irrigationType} size="small"
                    color={report.irrigationType === 'Irrigated' ? 'primary' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(report)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(report.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingReport ? 'Edit Harvest Record' : 'Add New Harvest Record'}
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
                  <MenuItem key={m} value={m}>{m}</MenuItem>
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
                  <MenuItem key={b} value={b}>{b}</MenuItem>
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
                  <MenuItem key={s.id} value={s.name}>{s.name} ({s.type})</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: '180px' }}>
                <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.875rem', color: 'text.secondary', fontWeight: 500 }}>
                  Harvest Date
                </Typography>
                <TextField
                  type="date"
                  value={formData.harvestDate || ''}
                  onChange={(e) => setFormData({ ...formData, harvestDate: e.target.value })}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#fff',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: '#f8fdf9',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#4caf50'
                        }
                      },
                      '&.Mui-focused': {
                        bgcolor: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#2e7d32',
                          borderWidth: '2px'
                        }
                      }
                    },
                    '& input[type="date"]': {
                      padding: '10px 14px',
                      fontSize: '0.95rem',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }
                  }}
                />
              </Box>
              <TextField
                label="Harvested Area"
                type="number"
                value={formData.harvestedArea || ''}
                onChange={(e) => setFormData({ ...formData, harvestedArea: parseFloat(e.target.value) })}
                {...standardInputProps}
                helperText="in hectares"
                sx={{ minWidth: '200px', flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                label="Total Production"
                type="number"
                value={formData.totalProduction || ''}
                onChange={(e) => setFormData({ ...formData, totalProduction: parseFloat(e.target.value) })}
                {...standardInputProps}
                helperText="in metric tons (MT)"
                sx={{ minWidth: '200px', flex: 1 }}
              />
              <Autocomplete
                freeSolo
                options={RICE_VARIETY_NAMES}
                value={formData.riceVariety || ''}
                onChange={(_e, value) =>
                  setFormData({
                    ...formData,
                    riceVariety: normalizeRiceVariety(value || ''),
                  })
                }
                onInputChange={(_e, value, reason) => {
                  if (reason === 'input') setFormData({ ...formData, riceVariety: value });
                }}
                sx={{ minWidth: '220px', flex: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Rice Variety"
                    required
                    helperText="Rizal DS 2026 catalog — type to add a rare name"
                    InputLabelProps={{
                      ...params.InputLabelProps,
                      ...standardInputProps.InputLabelProps,
                      shrink: true,
                    }}
                    sx={standardInputProps.sx}
                  />
                )}
              />
              <TextField
                select
                label="Irrigation Classification"
                value={formData.irrigationType || ''}
                onChange={(e) => setFormData({ ...formData, irrigationType: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '220px' }}
              >
                {irrigationTypes.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} variant="contained" sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}>
            {editingReport ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
