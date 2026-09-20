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
} from '@mui/material';
import { Search, People, Agriculture, Download } from '@mui/icons-material';
import { api, FarmerApi, FarmerStats, downloadBlob } from '../lib/api';
import { useLocations } from '../hooks/useLocations';

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

export function FarmersData() {
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
  const [snack, setSnack] = useState('');

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

  useEffect(() => {
    api.getFarmerStats().then(setStats).catch(() => setStats(null));
  }, []);

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
      setSnack('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Farmers Data (FIMS)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full Rizal FIMS registry — all fields from the source Excel file
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3, mt: 2 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <People color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
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
                <Typography variant="h4" fontWeight={700}>
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
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
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
                <TableCell colSpan={21} align="center" sx={{ py: 4 }}>
                  Loading farmers...
                </TableCell>
              </TableRow>
            ) : farmers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={21} align="center" sx={{ py: 4 }}>
                  No farmers found
                </TableCell>
              </TableRow>
            ) : (
              farmers.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {f.rsbsaNumber}
                  </TableCell>
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

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="error" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
