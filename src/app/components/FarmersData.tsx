import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Grid,
  Pagination,
  InputAdornment,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Search, People, Agriculture, Download, Add } from '@mui/icons-material';
import { api, ApiError, FarmerApi, FarmerStats, downloadBlob } from '../lib/api';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../context/AuthContext';
import { dialogActionsSx, dialogContentSx, standardInputProps } from '../styles/formStyles';

function yesNo(value: boolean) {
  return value ? 'YES' : 'NO';
}

function formatDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatArea(value: number | null) {
  if (value == null) return '';
  return value.toFixed(2);
}

const emptyFarmerForm = {
  rsbsaNumber: '',
  lastName: '',
  firstName: '',
  middleName: '',
  suffix: '',
  barangayId: '',
  farmerAddress1: '',
  farmerAddress2: 'Rizal',
  farmerAddress3: 'Palawan',
  farmAddress2: '',
  farmAddress3: '',
  birthdate: '',
  sex: '',
  contactNo: '',
  fourPs: 'NO',
  indigenous: 'NO',
  pwd: 'NO',
  farmArea: '',
  areaPlanted: '',
  commodity: 'Rice/Palay',
  farmerGeoCode: '',
  farmGeoCode: '',
};

type FarmerForm = typeof emptyFarmerForm;

export function FarmersData() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { barangays } = useLocations();
  const [farmers, setFarmers] = useState<FarmerApi[]>([]);
  const [stats, setStats] = useState<FarmerStats | null>(null);
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<FarmerForm>(emptyFarmerForm);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const loadFarmers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFarmers({
        search: search || undefined,
        barangay: barangayFilter || undefined,
        page,
        limit: 50,
      });
      setFarmers(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      setFarmers([]);
    } finally {
      setLoading(false);
    }
  }, [search, barangayFilter, page]);

  const loadStats = useCallback(() => {
    api.getFarmerStats().then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(loadFarmers, 300);
    return () => clearTimeout(timer);
  }, [loadFarmers]);

  useEffect(() => {
    setPage(1);
  }, [search, barangayFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.exportCsv('farmers');
      downloadBlob(blob, 'rizal-fims-farmers.csv');
    } catch {
      setSnack({ message: 'Export failed', severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const setField = (field: keyof FarmerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const openAddFarmer = () => {
    setForm(emptyFarmerForm);
    setFormError('');
    setDialogOpen(true);
  };

  const handleAddFarmer = async () => {
    const rsbsaNumber = form.rsbsaNumber.trim();
    const lastName = form.lastName.trim();
    const firstName = form.firstName.trim();
    const barangay = barangays.find((b) => String(b.id) === form.barangayId);
    const farmArea = Number(form.farmArea);
    const areaPlanted = form.areaPlanted.trim() === '' ? null : Number(form.areaPlanted);

    if (!rsbsaNumber || !lastName || !firstName || !form.sex || !barangay) {
      setFormError('RSBSA number, name, sex, and barangay are required');
      return;
    }
    if (!Number.isFinite(farmArea) || farmArea < 0) {
      setFormError('Farm area must be 0 or greater');
      return;
    }
    if (areaPlanted != null && (!Number.isFinite(areaPlanted) || areaPlanted < 0)) {
      setFormError('Area planted must be 0 or greater');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createFarmer({
        rsbsaNumber,
        lastName,
        firstName,
        middleName: form.middleName.trim(),
        suffix: form.suffix.trim(),
        farmerAddress1: barangay.name,
        farmerAddress2: form.farmerAddress2.trim() || 'Rizal',
        farmerAddress3: form.farmerAddress3.trim() || 'Palawan',
        farmAddress2: form.farmAddress2.trim(),
        farmAddress3: form.farmAddress3.trim(),
        birthdate: form.birthdate || null,
        sex: form.sex,
        contactNo: form.contactNo.trim(),
        fourPs: form.fourPs === 'YES',
        indigenous: form.indigenous === 'YES',
        pwd: form.pwd === 'YES',
        farmArea,
        areaPlanted,
        commodity: form.commodity.trim() || 'Rice/Palay',
        farmerGeoCode: form.farmerGeoCode.trim() || null,
        farmGeoCode: form.farmGeoCode.trim() || null,
        barangayId: barangay.id,
      });
      setDialogOpen(false);
      setSearch(created.rsbsaNumber);
      setBarangayFilter(created.barangay || barangay.name);
      setPage(1);
      setSnack({
        message: `Farmer added to Brgy. ${created.barangay || barangay.name}`,
        severity: 'success',
      });
      loadStats();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add farmer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Farmers Data (FIMS)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full Rizal FIMS registry — all fields from the source Excel file
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {isAdmin && (
            <Button variant="contained" startIcon={<Add />} onClick={openAddFarmer}>
              Add New Farmer
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </Box>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3, mt: 2 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <People color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.total.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Farmers
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Agriculture color="success" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.byBarangay.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Barangays Covered
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search by name or RSBSA number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280, flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Barangay"
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Barangays</MenuItem>
            {barangays.map((b) => (
              <MenuItem key={b.id} value={b.name}>
                {b.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small" stickyHeader sx={{ minWidth: 2200 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>RSBSA Number</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Barangay</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Last Name</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>First Name</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Middle Name</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Suffix</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farmer Address 1</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farmer Address 2</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farmer Address 3</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farm Address 2</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farm Address 3</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Birthdate</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Sex</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Contact No</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>4Ps</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Indigenous</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>PWD</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }} align="right">Farm Area (ha)</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }} align="right">Area Planted (ha)</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Commodity</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farmer GeoCode</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>Farm GeoCode</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={22} align="center" sx={{ py: 4 }}>
                  Loading farmers...
                </TableCell>
              </TableRow>
            ) : farmers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={22} align="center" sx={{ py: 4 }}>
                  No farmers found
                </TableCell>
              </TableRow>
            ) : (
              farmers.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {f.rsbsaNumber}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{f.barangay || '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.lastName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.firstName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.middleName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.suffix}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmerAddress1}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmerAddress2}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmerAddress3}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmAddress2}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmAddress3}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(f.birthdate)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.sex}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.contactNo}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{yesNo(f.fourPs)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{yesNo(f.indigenous)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{yesNo(f.pwd)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatArea(f.farmArea)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatArea(f.areaPlanted)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.commodity}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmerGeoCode ?? ''}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.farmGeoCode ?? ''}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {farmers.length} of {total.toLocaleString()} farmers — scroll horizontally to view all columns
        </Typography>
        {totalPages > 1 && (
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        )}
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Farmer</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Same fields as the FIMS farmers registry
          </Typography>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Farmer identity
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="RSBSA Number"
                required
                value={form.rsbsaNumber}
                onChange={(e) => setField('rsbsaNumber', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 220, flex: 1 }}
              />
              <TextField
                label="Last Name"
                required
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
              <TextField
                label="First Name"
                required
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Middle Name"
                value={form.middleName}
                onChange={(e) => setField('middleName', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
              <TextField
                label="Suffix"
                value={form.suffix}
                onChange={(e) => setField('suffix', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 120, flex: 1 }}
              />
              <TextField
                label="Birthdate"
                type="date"
                value={form.birthdate}
                onChange={(e) => setField('birthdate', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
              <TextField
                select
                label="Sex"
                required
                value={form.sex}
                onChange={(e) => setField('sex', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 140, flex: 1 }}
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
              </TextField>
              <TextField
                label="Contact No"
                value={form.contactNo}
                onChange={(e) => setField('contactNo', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
            </Box>

            <Typography variant="subtitle2" color="text.secondary">
              Address
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label="Designated Barangay"
                required
                value={form.barangayId}
                onChange={(e) => {
                  const id = e.target.value;
                  const name = barangays.find((b) => String(b.id) === id)?.name ?? '';
                  setForm((prev) => ({
                    ...prev,
                    barangayId: id,
                    farmerAddress1: name,
                  }));
                  setFormError('');
                }}
                helperText="Farmer will appear under this barangay in Farmers Data and report forms"
                {...standardInputProps}
                sx={{ minWidth: 220, flex: 1 }}
              >
                {barangays.map((b) => (
                  <MenuItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Farmer Address 1"
                value={form.farmerAddress1}
                helperText="Auto-filled from designated barangay"
                {...standardInputProps}
                slotProps={{
                  ...standardInputProps.slotProps,
                  input: { readOnly: true },
                }}
                sx={{ minWidth: 200, flex: 1 }}
              />
              <TextField
                label="Farmer Address 2"
                value={form.farmerAddress2}
                onChange={(e) => setField('farmerAddress2', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
              <TextField
                label="Farmer Address 3"
                value={form.farmerAddress3}
                onChange={(e) => setField('farmerAddress3', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Farm Address 2"
                value={form.farmAddress2}
                onChange={(e) => setField('farmAddress2', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 200, flex: 1 }}
              />
              <TextField
                label="Farm Address 3"
                value={form.farmAddress3}
                onChange={(e) => setField('farmAddress3', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 200, flex: 1 }}
              />
            </Box>

            <Typography variant="subtitle2" color="text.secondary">
              Farm details
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Farm Area (ha)"
                type="number"
                required
                value={form.farmArea}
                onChange={(e) => setField('farmArea', e.target.value)}
                {...standardInputProps}
                slotProps={{
                  ...standardInputProps.slotProps,
                  htmlInput: { min: 0, step: 0.01 },
                }}
                sx={{ minWidth: 150, flex: 1 }}
              />
              <TextField
                label="Area Planted (ha)"
                type="number"
                value={form.areaPlanted}
                onChange={(e) => setField('areaPlanted', e.target.value)}
                {...standardInputProps}
                slotProps={{
                  ...standardInputProps.slotProps,
                  htmlInput: { min: 0, step: 0.01 },
                }}
                sx={{ minWidth: 150, flex: 1 }}
              />
              <TextField
                label="Commodity"
                value={form.commodity}
                onChange={(e) => setField('commodity', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 160, flex: 1 }}
              />
              <TextField
                select
                label="4Ps"
                value={form.fourPs}
                onChange={(e) => setField('fourPs', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="NO">NO</MenuItem>
                <MenuItem value="YES">YES</MenuItem>
              </TextField>
              <TextField
                select
                label="Indigenous"
                value={form.indigenous}
                onChange={(e) => setField('indigenous', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="NO">NO</MenuItem>
                <MenuItem value="YES">YES</MenuItem>
              </TextField>
              <TextField
                select
                label="PWD"
                value={form.pwd}
                onChange={(e) => setField('pwd', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="NO">NO</MenuItem>
                <MenuItem value="YES">YES</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Farmer GeoCode"
                value={form.farmerGeoCode}
                onChange={(e) => setField('farmerGeoCode', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 200, flex: 1 }}
              />
              <TextField
                label="Farm GeoCode"
                value={form.farmGeoCode}
                onChange={(e) => setField('farmGeoCode', e.target.value)}
                {...standardInputProps}
                sx={{ minWidth: 200, flex: 1 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleAddFarmer()} disabled={submitting}>
            {submitting ? 'Saving...' : 'Add Farmer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
      >
        <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
