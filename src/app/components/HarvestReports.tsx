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
import { api, ApiError, HarvestReportApi, downloadBlob } from '../lib/api';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';
import { RICE_VARIETY_NAMES, normalizeRiceVariety } from '../lib/riceVarieties';
import { FarmerNameSelect } from './FarmerNameSelect';

const IRRIGATION_TYPES = ['Irrigated', 'Rainfed'];

export function HarvestReports({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { barangays: barangayList } = useLocations();
  const assignedBarangay = user?.role === 'technician' ? user.municipality || '' : '';
  const [reports, setReports] = useState<HarvestReportApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<HarvestReportApi | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<HarvestReportApi>>({});
  const [snack, setSnack] = useState('');
  const [printing, setPrinting] = useState(false);

  const barangays = barangayList.map((b) => b.name);

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
    void loadReports();
  }, [loadReports]);

  const handleAdd = () => {
    setEditingReport(null);
    setFormData({
      irrigationType: 'Irrigated',
      municipality: 'Rizal',
      farmerName: '',
      bagsHarvested: 0,
      weightPerBag: 50,
      remarks: '',
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
    if (!confirm('Delete this harvesting report row?')) return;
    try {
      await api.deleteHarvestReport(id);
      await loadReports();
      setSnack('Row deleted');
    } catch {
      setSnack('Delete failed');
    }
  };

  const handleSave = async () => {
    if (!formData.barangay || !formData.riceVariety || !formData.farmerName?.trim()) {
      setSnack('Select a registered farmer, barangay, and variety');
      return;
    }
    try {
      const payload = {
        municipality: formData.municipality || 'Rizal',
        barangay: formData.barangay,
        sitio: formData.sitio || '-',
        farmerName: formData.farmerName.trim(),
        harvestDate: formData.harvestDate || new Date().toISOString().split('T')[0],
        harvestedArea: formData.harvestedArea || 0,
        riceVariety: normalizeRiceVariety(formData.riceVariety || ''),
        irrigationType: formData.irrigationType || 'Irrigated',
        bagsHarvested: formData.bagsHarvested || 0,
        weightPerBag: formData.weightPerBag || 50,
        remarks: formData.remarks || '',
      };
      if (editingReport) {
        await api.updateHarvestReport(editingReport.id, payload);
      } else {
        await api.createHarvestReport(payload);
      }
      setDialogOpen(false);
      await loadReports();
      setSnack(editingReport ? 'Harvest row updated' : 'Harvest row saved');
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

  const handlePrintPaper = async () => {
    setPrinting(true);
    try {
      const targetBarangay =
        assignedBarangay ||
        reports.find((r) => r.barangay.toLowerCase().includes(searchTerm.toLowerCase()))?.barangay ||
        reports[0]?.barangay;
      if (!targetBarangay && user?.role !== 'technician') {
        setSnack('Add a harvest row first, or search a barangay');
        return;
      }
      const html = await api.getBarangayPaperHtml('harvest', {
        barangay: user?.role === 'technician' ? undefined : targetBarangay,
        source: 'data',
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        downloadBlob(blob, 'harvesting-report-paper.html');
        setSnack('Pop-up blocked — paper downloaded instead');
      } else {
        setSnack('Harvesting paper opened — use Print / Save as PDF');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : 'Failed to open harvesting paper');
    } finally {
      setPrinting(false);
    }
  };

  const filteredReports = reports.filter(
    (r) =>
      !searchTerm ||
      r.farmerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.barangay.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.riceVariety.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          {!embedded && (
            <Typography variant="h4" fontWeight="bold">
              Harvesting Reports
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Matches the official HARVESTING REPORT paper — one farmer row per entry
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
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>NO.</TableCell>
              <TableCell>NAME OF FARMERS</TableCell>
              {!assignedBarangay && <TableCell>Barangay</TableCell>}
              <TableCell>Irrigated/Rainfed</TableCell>
              <TableCell>AREA (HA.)</TableCell>
              <TableCell>Date harvested</TableCell>
              <TableCell>VARIETY PLANTED</TableCell>
              <TableCell>Total # of bags</TableCell>
              <TableCell>Weight per bag (kg)</TableCell>
              <TableCell>REMARKS</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={assignedBarangay ? 10 : 11} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredReports.length === 0 && (
              <TableRow>
                <TableCell colSpan={assignedBarangay ? 10 : 11} align="center">
                  No harvest rows yet — add farmer rows like the paper form
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
                <TableCell>{report.harvestedArea}</TableCell>
                <TableCell>{new Date(report.harvestDate).toLocaleDateString()}</TableCell>
                <TableCell>{report.riceVariety}</TableCell>
                <TableCell>{report.bagsHarvested || '—'}</TableCell>
                <TableCell>{report.weightPerBag || '—'}</TableCell>
                <TableCell>{report.remarks || '—'}</TableCell>
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
        <DialogTitle>{editingReport ? 'Edit harvesting row' : 'Add harvesting row'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Same fields as the HARVESTING REPORT paper (Municipality of Dr. Jose P. Rizal)
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
                label="Area (HA.)"
                type="number"
                value={formData.harvestedArea ?? ''}
                onChange={(e) => setFormData({ ...formData, harvestedArea: parseFloat(e.target.value) })}
                {...standardInputProps}
                sx={{ minWidth: 140 }}
              />
              <Box sx={{ minWidth: 180, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 0.5, fontSize: '0.875rem', color: 'text.secondary', fontWeight: 500 }}
                >
                  Date harvested
                </Typography>
                <TextField
                  type="date"
                  value={formData.harvestDate || ''}
                  onChange={(e) => setFormData({ ...formData, harvestDate: e.target.value })}
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
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Autocomplete
                freeSolo
                options={RICE_VARIETY_NAMES}
                value={formData.riceVariety || ''}
                onChange={(_e, value) =>
                  setFormData({ ...formData, riceVariety: normalizeRiceVariety(value || '') })
                }
                onInputChange={(_e, value, reason) => {
                  if (reason === 'input') setFormData({ ...formData, riceVariety: value });
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
              <TextField
                label="Total # of bags harvested"
                type="number"
                value={formData.bagsHarvested ?? ''}
                onChange={(e) => setFormData({ ...formData, bagsHarvested: parseInt(e.target.value, 10) || 0 })}
                {...standardInputProps}
                sx={{ minWidth: 180 }}
              />
              <TextField
                label="Weight per bag (kg)"
                type="number"
                value={formData.weightPerBag ?? 50}
                onChange={(e) => setFormData({ ...formData, weightPerBag: parseFloat(e.target.value) || 50 })}
                {...standardInputProps}
                sx={{ minWidth: 160 }}
              />
            </Box>
            <TextField
              label="Remarks"
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              multiline
              minRows={2}
              {...standardInputProps}
              fullWidth
            />
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
