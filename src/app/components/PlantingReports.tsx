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
  Autocomplete,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, Search, Print, Download } from '@mui/icons-material';
import { api, ApiError, PlantingReportApi, downloadBlob } from '../lib/api';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';
import { RICE_VARIETY_NAMES, normalizeRiceVariety } from '../lib/riceVarieties';
import { FarmerNameSelect } from './FarmerNameSelect';

const IRRIGATION_TYPES = ['Irrigated', 'Rainfed'];
const CROPPING_OPTIONS = ['1st', '2nd', '3rd'];

export function PlantingReports({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { barangays: barangayList } = useLocations();
  const assignedBarangay = user?.role === 'technician' ? user.municipality || '' : '';
  const [reports, setReports] = useState<PlantingReportApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<PlantingReportApi | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<PlantingReportApi>>({});
  const [snack, setSnack] = useState('');
  const [filterCropping, setFilterCropping] = useState('');
  const [printing, setPrinting] = useState(false);

  const barangays = barangayList.map((b) => b.name);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await api.getPlantingReports());
    } catch {
      setSnack('Failed to load planting reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleAdd = () => {
    setEditingReport(null);
    setFormData({
      irrigationType: 'Irrigated',
      season: '1st',
      municipality: 'Rizal',
      farmerName: '',
      farmerCount: 1,
      ...(assignedBarangay ? { barangay: assignedBarangay } : {}),
    });
    setDialogOpen(true);
  };

  const handleEdit = (report: PlantingReportApi) => {
    setEditingReport(report);
    setFormData(report);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this planting report row?')) return;
    try {
      await api.deletePlantingReport(id);
      await loadReports();
      setSnack('Row deleted');
    } catch {
      setSnack('Delete failed');
    }
  };

  const handleSave = async () => {
    if (!formData.barangay || !formData.seedVariety || !formData.farmerName?.trim()) {
      setSnack('Select a registered farmer, barangay, and variety');
      return;
    }
    try {
      const payload = {
        municipality: formData.municipality || 'Rizal',
        barangay: formData.barangay,
        sitio: formData.sitio || '-',
        farmerName: formData.farmerName.trim(),
        farmerCount: 1,
        seedVariety: normalizeRiceVariety(formData.seedVariety || ''),
        areaPlanted: formData.areaPlanted || 0,
        datePlanted: formData.datePlanted || new Date().toISOString().split('T')[0],
        irrigationType: formData.irrigationType || 'Irrigated',
        season: formData.season || '1st',
        expectedHarvest: formData.expectedHarvest || '',
      };
      if (editingReport) {
        await api.updatePlantingReport(editingReport.id, payload);
      } else {
        await api.createPlantingReport(payload);
      }
      setDialogOpen(false);
      await loadReports();
      setSnack(editingReport ? 'Planting row updated' : 'Planting row saved');
    } catch {
      setSnack('Save failed — check all fields');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportCsv('planting');
      downloadBlob(blob, 'planting-reports.csv');
    } catch {
      setSnack('Export failed');
    }
  };

  const handlePrintPaper = async () => {
    setPrinting(true);
    try {
      const targetBarangay =
        assignedBarangay ||
        reports.find((r) => r.barangay.toLowerCase().includes(searchTerm.toLowerCase()))?.barangay ||
        reports[0]?.barangay;
      if (!targetBarangay && user?.role !== 'technician') {
        setSnack('Add a planting row first, or search a barangay');
        return;
      }
      const html = await api.getBarangayPaperHtml('planting', {
        barangay: user?.role === 'technician' ? undefined : targetBarangay,
        source: 'data',
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        downloadBlob(blob, 'planting-report-paper.html');
        setSnack('Pop-up blocked — paper downloaded instead');
      } else {
        setSnack('Planting paper opened — use Print / Save as PDF');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : 'Failed to open planting paper');
    } finally {
      setPrinting(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      r.farmerName.toLowerCase().includes(q) ||
      r.barangay.toLowerCase().includes(q) ||
      r.seedVariety.toLowerCase().includes(q);
    const matchCropping = !filterCropping || r.season === filterCropping;
    return matchSearch && matchCropping;
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          {!embedded && (
            <Typography variant="h4" fontWeight="bold">
              Planting Reports
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Matches the official PLANTING REPORT paper — one farmer row per entry
            {assignedBarangay ? ` · Brgy. ${assignedBarangay} only` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Print />} disabled={printing} onClick={() => void handlePrintPaper()}>
            Print paper form
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={() => void handleExport()}>
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAdd}
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
          >
            Add farmer row
          </Button>
        </Box>
      </Box>

      {assignedBarangay && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Scoped to your assigned barangay: <strong>{assignedBarangay}</strong>
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search farmer, barangay, or variety..."
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
          <TextField
            select
            size="small"
            label="Cropping"
            value={filterCropping}
            onChange={(e) => setFilterCropping(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="">All</MenuItem>
            {CROPPING_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>NO.</TableCell>
              <TableCell>NAME OF FARMERS</TableCell>
              {!assignedBarangay && <TableCell>Barangay</TableCell>}
              <TableCell>IRRIGATED / RAINFED</TableCell>
              <TableCell>AREA (Ha.)</TableCell>
              <TableCell>VARIETY PLANTED</TableCell>
              <TableCell>DATE PLANTED</TableCell>
              <TableCell>CROPPING (1st, 2nd, 3rd)</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={assignedBarangay ? 8 : 9} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredReports.length === 0 && (
              <TableRow>
                <TableCell colSpan={assignedBarangay ? 8 : 9} align="center">
                  No planting rows yet — add farmer rows like the paper form
                </TableCell>
              </TableRow>
            )}
            {filteredReports.map((report, index) => (
              <TableRow key={report.id} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{report.farmerName || '—'}</TableCell>
                {!assignedBarangay && <TableCell>{report.barangay}</TableCell>}
                <TableCell>
                  <Chip
                    label={report.irrigationType}
                    size="small"
                    color={report.irrigationType === 'Irrigated' ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell>{report.areaPlanted}</TableCell>
                <TableCell>{report.seedVariety}</TableCell>
                <TableCell>{new Date(report.datePlanted).toLocaleDateString()}</TableCell>
                <TableCell>{report.season}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(report)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => void handleDelete(report.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingReport ? 'Edit planting row' : 'Add planting row'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Same fields as the PLANTING REPORT paper (Municipality of Dr. Jose P. Rizal)
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label="Barangay"
                required
                value={formData.barangay || ''}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value, farmerName: '' })}
                disabled={!!assignedBarangay}
                helperText={assignedBarangay ? 'Locked to your assigned barangay' : undefined}
                {...standardInputProps}
                sx={{ minWidth: 200, flex: 1 }}
              >
                {barangays.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
              <FarmerNameSelect
                barangay={formData.barangay || ''}
                value={formData.farmerName || ''}
                onChange={(farmerName) => setFormData({ ...formData, farmerName })}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label="Irrigated / Rainfed"
                value={formData.irrigationType || ''}
                onChange={(e) => setFormData({ ...formData, irrigationType: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: 160 }}
              >
                {IRRIGATION_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Area (Ha.)"
                type="number"
                value={formData.areaPlanted ?? ''}
                onChange={(e) => setFormData({ ...formData, areaPlanted: parseFloat(e.target.value) })}
                {...standardInputProps}
                sx={{ minWidth: 140 }}
              />
              <Autocomplete
                freeSolo
                options={RICE_VARIETY_NAMES}
                value={formData.seedVariety || ''}
                onChange={(_e, value) =>
                  setFormData({ ...formData, seedVariety: normalizeRiceVariety(value || '') })
                }
                onInputChange={(_e, value, reason) => {
                  if (reason === 'input') setFormData({ ...formData, seedVariety: value });
                }}
                sx={{ minWidth: 200, flex: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Variety Planted"
                    required
                    InputLabelProps={{
                      ...params.InputLabelProps,
                      ...standardInputProps.InputLabelProps,
                      shrink: true,
                    }}
                    sx={standardInputProps.sx}
                  />
                )}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 180, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 0.5, fontSize: '0.875rem', color: 'text.secondary', fontWeight: 500 }}
                >
                  Date Planted
                </Typography>
                <TextField
                  type="date"
                  value={formData.datePlanted || ''}
                  onChange={(e) => setFormData({ ...formData, datePlanted: e.target.value })}
                  fullWidth
                  {...standardInputProps}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    ...(standardInputProps.sx as object),
                    '& input[type="date"]': {
                      padding: '12px 14px',
                      fontSize: '0.95rem',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    },
                  }}
                />
              </Box>
              <TextField
                select
                label="Cropping (1st, 2nd, 3rd)"
                value={formData.season || '1st'}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                {...standardInputProps}
                sx={{ ...(standardInputProps.sx as object), minWidth: 180 }}
              >
                {CROPPING_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
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
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
          >
            {editingReport ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
