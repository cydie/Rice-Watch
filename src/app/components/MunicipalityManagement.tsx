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
  Tabs,
  Tab,
  Chip,
  MenuItem,
  Grid,
} from '@mui/material';
import { Add, Edit, Delete, LocationCity, Place } from '@mui/icons-material';
import { api, BarangayApi, SitioApi } from '../lib/api';
import { Snackbar } from '@mui/material';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';

export function MunicipalityManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [barangays, setBarangays] = useState<BarangayApi[]>([]);
  const [sitios, setSitios] = useState<SitioApi[]>([]);
  const [snack, setSnack] = useState('');

  const [barangayDialogOpen, setBarangayDialogOpen] = useState(false);
  const [sitioDialogOpen, setSitioDialogOpen] = useState(false);

  const [editingBarangay, setEditingBarangay] = useState<BarangayApi | null>(null);
  const [editingSitio, setEditingSitio] = useState<SitioApi | null>(null);

  const [barangayFormData, setBarangayFormData] = useState<Partial<BarangayApi>>({});
  const [sitioFormData, setSitioFormData] = useState<Partial<SitioApi>>({});

  const loadData = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([api.getBarangays(), api.getSitios()]);
      setBarangays(b);
      setSitios(s);
    } catch {
      setSnack('Failed to load barangay data');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalArea = barangays.reduce((sum, b) => sum + b.area, 0);
  const irrigatedArea = barangays.filter(b => b.classification === 'Irrigated').reduce((sum, b) => sum + b.area, 0);
  const rainfedArea = barangays.filter(b => b.classification === 'Rainfed').reduce((sum, b) => sum + b.area, 0);

  const handleAddBarangay = () => {
    setEditingBarangay(null);
    setBarangayFormData({ classification: 'Irrigated' });
    setBarangayDialogOpen(true);
  };

  const handleEditBarangay = (barangay: BarangayApi) => {
    setEditingBarangay(barangay);
    setBarangayFormData(barangay);
    setBarangayDialogOpen(true);
  };

  const handleDeleteBarangay = async (id: number) => {
    if (!confirm('Are you sure you want to delete this barangay? All associated sitios will also be deleted.')) return;
    try {
      await api.deleteBarangay(id);
      await loadData();
      setSnack('Barangay deleted');
    } catch {
      setSnack('Delete failed — barangay may have linked reports');
    }
  };

  const handleSaveBarangay = async () => {
    try {
      if (editingBarangay) {
        await api.updateBarangay(editingBarangay.id, barangayFormData);
      } else {
        await api.createBarangay(barangayFormData as BarangayApi);
      }
      setBarangayDialogOpen(false);
      await loadData();
      setSnack(editingBarangay ? 'Barangay updated' : 'Barangay added');
    } catch {
      setSnack('Save barangay failed');
    }
  };

  const handleAddSitio = () => {
    setEditingSitio(null);
    setSitioFormData({ type: 'Sitio' });
    setSitioDialogOpen(true);
  };

  const handleEditSitio = (sitio: SitioApi) => {
    setEditingSitio(sitio);
    setSitioFormData(sitio);
    setSitioDialogOpen(true);
  };

  const handleDeleteSitio = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sitio/purok?')) return;
    try {
      await api.deleteSitio(id);
      await loadData();
      setSnack('Sitio deleted');
    } catch {
      setSnack('Delete failed');
    }
  };

  const handleSaveSitio = async () => {
    if (!sitioFormData.barangayId || !sitioFormData.name) {
      setSnack('Barangay and name are required');
      return;
    }
    try {
      if (editingSitio) {
        await api.updateSitio(editingSitio.id, sitioFormData);
      } else {
        await api.createSitio({
          barangayId: sitioFormData.barangayId,
          name: sitioFormData.name,
          type: sitioFormData.type || 'Sitio',
        });
      }
      setSitioDialogOpen(false);
      await loadData();
      setSnack(editingSitio ? 'Sitio updated' : 'Sitio added');
    } catch {
      setSnack('Save sitio failed');
    }
  };

  const getBarangayName = (id: number) => {
    return barangays.find(b => b.id === id)?.name || 'Unknown';
  };

  const getSitiosForBarangay = (barangayId: number) => {
    return sitios.filter(s => s.barangayId === barangayId);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Barangay Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage barangay divisions and area classifications - Rizal, Palawan
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Overview" />
          <Tab label="Barangays" />
          <Tab label="Sitios/Puroks" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <LocationCity sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h6" fontWeight="bold">Rizal</Typography>
                <Typography variant="caption" color="text.secondary">Municipality</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary">Total Barangays</Typography>
                <Typography variant="h4" fontWeight="bold">{barangays.length}</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary">Total Sitios/Puroks</Typography>
                <Typography variant="h4" fontWeight="bold">{sitios.length}</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary">Total Area</Typography>
                <Typography variant="h4" fontWeight="bold">{totalArea.toFixed(1)}</Typography>
                <Typography variant="caption" color="text.secondary">hectares</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Area Classification</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">Irrigated</Typography>
                      <Typography variant="h5" fontWeight="bold" color="primary">{irrigatedArea.toFixed(1)} ha</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">Rainfed</Typography>
                      <Typography variant="h5" fontWeight="bold" color="success">{rainfedArea.toFixed(1)} ha</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">Total</Typography>
                      <Typography variant="h5" fontWeight="bold">{totalArea.toFixed(1)} ha</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {tabValue === 1 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddBarangay}
              sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
            >
              Add Barangay
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell>Barangay</TableCell>
                  <TableCell>Area (ha)</TableCell>
                  <TableCell>Classification</TableCell>
                  <TableCell>Sitios/Puroks</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {barangays.map((brgy) => (
                  <TableRow key={brgy.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Place color="primary" />
                        {brgy.name}
                      </Box>
                    </TableCell>
                    <TableCell>{brgy.area}</TableCell>
                    <TableCell>
                      <Chip
                        label={brgy.classification}
                        size="small"
                        color={brgy.classification === 'Irrigated' ? 'primary' : 'success'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={getSitiosForBarangay(brgy.id).length} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleEditBarangay(brgy)} color="primary">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteBarangay(brgy.id)} color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tabValue === 2 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddSitio}
              sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
            >
              Add Sitio/Purok
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell>Sitio/Purok Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Barangay</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sitios.map((sitio) => (
                  <TableRow key={sitio.id} hover>
                    <TableCell>{sitio.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={sitio.type}
                        size="small"
                        color={sitio.type === 'Sitio' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>{getBarangayName(sitio.barangayId)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleEditSitio(sitio)} color="primary">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSitio(sitio.id)} color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Dialog
        open={barangayDialogOpen}
        onClose={() => setBarangayDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, m: { xs: 2, sm: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {editingBarangay ? 'Edit Barangay' : 'Add New Barangay'}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box
            component="form"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              width: '100%',
              minWidth: 0,
              pt: 0.5,
            }}
          >
            <TextField
              fullWidth
              label="Barangay Name"
              value={barangayFormData.name || ''}
              onChange={(e) => setBarangayFormData({ ...barangayFormData, name: e.target.value })}
              required
              {...standardInputProps}
            />
            <TextField
              fullWidth
              label="Area (hectares)"
              type="number"
              value={barangayFormData.area ?? ''}
              onChange={(e) =>
                setBarangayFormData({ ...barangayFormData, area: parseFloat(e.target.value) })
              }
              inputProps={{ min: 0, step: 0.1 }}
              {...standardInputProps}
            />
            <TextField
              select
              fullWidth
              label="Classification"
              value={barangayFormData.classification || 'Irrigated'}
              onChange={(e) =>
                setBarangayFormData({ ...barangayFormData, classification: e.target.value })
              }
              {...standardInputProps}
            >
              <MenuItem value="Irrigated">Irrigated</MenuItem>
              <MenuItem value="Rainfed">Rainfed</MenuItem>
              <MenuItem value="Upland">Upland</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            ...dialogActionsSx,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 100 } },
          }}
        >
          <Button onClick={() => setBarangayDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => void handleSaveBarangay()}
            variant="contained"
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
          >
            {editingBarangay ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sitioDialogOpen}
        onClose={() => setSitioDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, m: { xs: 2, sm: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {editingSitio ? 'Edit Sitio/Purok' : 'Add New Sitio/Purok'}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box
            component="form"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              width: '100%',
              minWidth: 0,
              pt: 0.5,
            }}
          >
            <TextField
              select
              fullWidth
              label="Barangay"
              value={sitioFormData.barangayId ?? ''}
              onChange={(e) =>
                setSitioFormData({ ...sitioFormData, barangayId: Number(e.target.value) })
              }
              required
              helperText="Select the parent barangay"
              {...standardInputProps}
              SelectProps={{
                MenuProps: { PaperProps: { sx: { maxHeight: 280 } } },
              }}
            >
              <MenuItem value="" disabled>
                Select barangay
              </MenuItem>
              {barangays.map((brgy) => (
                <MenuItem key={brgy.id} value={brgy.id}>
                  {brgy.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Sitio/Purok Name"
              value={sitioFormData.name || ''}
              onChange={(e) => setSitioFormData({ ...sitioFormData, name: e.target.value })}
              placeholder="e.g., Sitio 1, Purok 2"
              required
              {...standardInputProps}
            />
            <TextField
              select
              fullWidth
              label="Type"
              value={sitioFormData.type || 'Sitio'}
              onChange={(e) =>
                setSitioFormData({ ...sitioFormData, type: e.target.value as 'Sitio' | 'Purok' })
              }
              {...standardInputProps}
            >
              <MenuItem value="Sitio">Sitio</MenuItem>
              <MenuItem value="Purok">Purok</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            ...dialogActionsSx,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 100 } },
          }}
        >
          <Button onClick={() => setSitioDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => void handleSaveSitio()}
            variant="contained"
            sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
          >
            {editingSitio ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
