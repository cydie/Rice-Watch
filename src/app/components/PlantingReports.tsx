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
  Autocomplete,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  FileUpload,
  Download
} from '@mui/icons-material';
import { api, PlantingReportApi, downloadBlob } from '../lib/api';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';
import { RICE_VARIETY_NAMES, normalizeRiceVariety } from '../lib/riceVarieties';

export function PlantingReports() {
  const { user } = useAuth();
  const { barangays: barangayList, getSitiosByBarangayName } = useLocations();
  const assignedBarangay = user?.role === 'technician' ? user.municipality || '' : '';
  const [reports, setReports] = useState<PlantingReportApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<PlantingReportApi | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<PlantingReportApi>>({});
  const [snack, setSnack] = useState('');
  const [filterSeason, setFilterSeason] = useState('');

  const municipalities = ['Rizal'];
  const barangays = barangayList.map((b) => b.name);
  const availableSitios = formData.barangay ? getSitiosByBarangayName(formData.barangay) : [];

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
    loadReports();
  }, [loadReports]);
  const irrigationTypes = ['Irrigated', 'Rainfed', 'Upland'];
  const seasons = ['Wet Season', 'Dry Season'];

  const handleAdd = () => {
    setEditingReport(null);
    setFormData({
      irrigationType: 'Irrigated',
      season: 'Wet Season',
      municipality: 'Rizal',
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
    if (!confirm('Are you sure you want to delete this planting report?')) return;
    try {
      await api.deletePlantingReport(id);
      await loadReports();
      setSnack('Report deleted');
    } catch {
      setSnack('Delete failed');
    }
  };

  const handleSave = async () => {
    if (!formData.barangay || !formData.seedVariety) {
      setSnack('Please fill required fields');
      return;
    }
    try {
      const payload = {
        municipality: formData.municipality || 'Rizal',
        barangay: formData.barangay,
        sitio: formData.sitio || '-',
        farmerCount: formData.farmerCount || 0,
        seedVariety: normalizeRiceVariety(formData.seedVariety || ''),
        areaPlanted: formData.areaPlanted || 0,
        datePlanted: formData.datePlanted || new Date().toISOString().split('T')[0],
        irrigationType: formData.irrigationType || 'Irrigated',
        season: formData.season || 'Wet Season',
        expectedHarvest: formData.expectedHarvest || new Date().toISOString().split('T')[0],
      };
      if (editingReport) {
        await api.updatePlantingReport(editingReport.id, payload);
      } else {
        await api.createPlantingReport(payload);
      }
      setDialogOpen(false);
      await loadReports();
      setSnack(editingReport ? 'Report updated' : 'Report saved');
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

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = () => setSnack('CSV import: use Add Report or contact admin for bulk import');
    input.click();
  };

  const filteredReports = reports.filter((r) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      r.municipality.toLowerCase().includes(q) ||
      r.barangay.toLowerCase().includes(q) ||
      r.seedVariety.toLowerCase().includes(q);
    const matchSeason = !filterSeason || r.season === filterSeason;
    return matchSearch && matchSeason;
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Planting Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage rice planting records and schedules
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FileUpload />} onClick={handleImport}>
            Import Excel
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
            Export
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={handleAdd}
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}>
            Add Report
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search by municipality, barangay, or variety..."
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
            label="Season"
            value={filterSeason}
            onChange={(e) => setFilterSeason(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {seasons.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>Municipality</TableCell>
              <TableCell>Barangay</TableCell>
              <TableCell>Sitio/Purok</TableCell>
              <TableCell>Farmers</TableCell>
              <TableCell>Seed Variety</TableCell>
              <TableCell>Area (ha)</TableCell>
              <TableCell>Date Planted</TableCell>
              <TableCell>Irrigation</TableCell>
              <TableCell>Season</TableCell>
              <TableCell>Expected Harvest</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={11} align="center">Loading...</TableCell>
              </TableRow>
            )}
            {!loading && filteredReports.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center">No reports found</TableCell>
              </TableRow>
            )}
            {filteredReports.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell>{report.municipality}</TableCell>
                <TableCell>{report.barangay}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{report.sitio}</Typography>
                </TableCell>
                <TableCell>{report.farmerCount}</TableCell>
                <TableCell>{report.seedVariety}</TableCell>
                <TableCell>{report.areaPlanted}</TableCell>
                <TableCell>{new Date(report.datePlanted).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Chip
                    label={report.irrigationType}
                    size="small"
                    color={report.irrigationType === 'Irrigated' ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell>{report.season}</TableCell>
                <TableCell>{new Date(report.expectedHarvest).toLocaleDateString()}</TableCell>
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
          {editingReport ? 'Edit Planting Report' : 'Add New Planting Report'}
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
              <TextField
                label="Number of Farmers"
                type="number"
                value={formData.farmerCount || ''}
                onChange={(e) => setFormData({ ...formData, farmerCount: parseInt(e.target.value) })}
                {...standardInputProps}
                sx={{ minWidth: '200px', flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Autocomplete
                freeSolo
                options={RICE_VARIETY_NAMES}
                value={formData.seedVariety || ''}
                onChange={(_e, value) =>
                  setFormData({
                    ...formData,
                    seedVariety: normalizeRiceVariety(value || ''),
                  })
                }
                onInputChange={(_e, value, reason) => {
                  if (reason === 'input') setFormData({ ...formData, seedVariety: value });
                }}
                sx={{ minWidth: '220px', flex: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Seed Variety"
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
                label="Area Planted"
                type="number"
                value={formData.areaPlanted || ''}
                onChange={(e) => setFormData({ ...formData, areaPlanted: parseFloat(e.target.value) })}
                {...standardInputProps}
                helperText="in hectares"
                sx={{ minWidth: '200px', flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: '180px' }}>
                <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.875rem', color: 'text.secondary', fontWeight: 500 }}>
                  Date Planted
                </Typography>
                <TextField
                  type="date"
                  value={formData.datePlanted || ''}
                  onChange={(e) => setFormData({ ...formData, datePlanted: e.target.value })}
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
                select
                label="Irrigation Type"
                value={formData.irrigationType || ''}
                onChange={(e) => setFormData({ ...formData, irrigationType: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '160px' }}
              >
                {irrigationTypes.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Season"
                value={formData.season || ''}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                {...standardInputProps}
                sx={{ minWidth: '160px' }}
              >
                {seasons.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ minWidth: '220px' }}>
                <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.875rem', color: 'text.secondary', fontWeight: 500 }}>
                  Expected Harvest Date
                </Typography>
                <TextField
                  type="date"
                  value={formData.expectedHarvest || ''}
                  onChange={(e) => setFormData({ ...formData, expectedHarvest: e.target.value })}
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
