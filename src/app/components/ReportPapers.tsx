import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Alert,
  Chip,
  Snackbar,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Download,
  UploadFile,
  Description,
  AutoAwesome,
  FactCheck,
} from '@mui/icons-material';
import { api, ApiError, downloadBlob, TechnicianGuideApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type ReportKind = 'planting' | 'harvest' | 'standing';

const KINDS: { type: ReportKind; title: string; blurb: string }[] = [
  {
    type: 'planting',
    title: 'Planting Report',
    blurb: 'Upload barangay planting masterlist → system builds DS planting paper totals.',
  },
  {
    type: 'harvest',
    title: 'Harvesting Report',
    blurb: 'Upload harvest masterlist with bags/weight → municipal harvest paper regenerates.',
  },
  {
    type: 'standing',
    title: 'Standing Crop',
    blurb: 'Upload standing crop by stage & irrigation → DA standing crop paper regenerates.',
  },
];

const RIZAL_BARANGAYS = [
  'Bunog',
  'Campong Ulay',
  'Candawaga',
  'Canipaan',
  'Culasian',
  'Iraan',
  'Latud',
  'Panalingaan',
  'Punta Baja (Poblacion)',
  'Ransang',
  'Taburi',
];

export function ReportPapers() {
  const { user } = useAuth();
  const isTechnician = user?.role === 'technician';
  const assigned = user?.municipality;
  const fileRefs = useRef<Record<ReportKind, HTMLInputElement | null>>({
    planting: null,
    harvest: null,
    standing: null,
  });
  const [busy, setBusy] = useState<string>('');
  const [snack, setSnack] = useState('');
  const [error, setError] = useState('');
  const [guide, setGuide] = useState<TechnicianGuideApi | null>(null);
  const [guideBarangay, setGuideBarangay] = useState(assigned || 'Iraan');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    const barangay = isTechnician ? assigned || undefined : guideBarangay;
    void api
      .getTechnicianGuide(barangay)
      .then(setGuide)
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load technician guide');
      });
  }, [isTechnician, assigned, guideBarangay]);

  const downloadTemplate = (type: ReportKind) =>
    run(`tpl-${type}`, async () => {
      const blob = await api.downloadReportTemplate(type);
      downloadBlob(blob, `ricewatch-${type}-masterlist-template.xlsx`);
      setSnack('Blank template downloaded');
    });

  const downloadFilled = (type: ReportKind) =>
    run(`filled-${type}`, async () => {
      const barangay = isTechnician ? undefined : guideBarangay;
      const blob = await api.downloadFilledTemplate(type, barangay);
      const slug = (isTechnician ? assigned : guideBarangay || 'barangay')
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      downloadBlob(blob, `ricewatch-${slug}-${type}-official-aligned.xlsx`);
      setSnack('Official DS 2026–aligned masterlist downloaded');
    });

  const generatePaper = (type: ReportKind) =>
    run(`gen-${type}`, async () => {
      const blob = await api.generateMunicipalPaper(type);
      downloadBlob(blob, `RiceWatch-DS2026-${type}-paper.xlsx`);
      setSnack('Municipal paper generated from current database');
    });

  const onFile = (type: ReportKind, file?: File | null) => {
    if (!file) return;
    void run(`up-${type}`, async () => {
      const result = await api.uploadReportMasterlist(type, file);
      setSnack(
        `${result.message}: ${result.rows} rows → ${result.created} report groups` +
          (result.barangayScope ? ` (Brgy. ${result.barangayScope})` : '')
      );
    });
  };

  const planting = guide?.planting;
  const harvest = guide?.harvest;
  const standing = guide?.standing;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Paper Reports & Upload
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isTechnician
          ? `As technician, input only your assigned barangay${assigned ? ` (${assigned})` : ''}. Use columns and totals that match the official DS 2026 papers so the Department Head can generate an accurate municipal paper.`
          : 'Technicians upload barangay masterlists. Department Head generates the municipal paper that matches the official DS 2026 layout.'}
      </Typography>

      {isTechnician && assigned && (
        <Chip color="success" label={`Assigned barangay: ${assigned}`} sx={{ mb: 2 }} />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'success.light' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
          <FactCheck color="success" />
          <Typography variant="h6" fontWeight="bold">
            Technician input guide (official DS 2026)
          </Typography>
          {!isTechnician && (
            <TextField
              select
              size="small"
              label="Barangay"
              value={guideBarangay}
              onChange={(e) => setGuideBarangay(e.target.value)}
              sx={{ minWidth: 220, ml: 'auto' }}
            >
              {RIZAL_BARANGAYS.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>

        {guide && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Season: <strong>{guide.season}</strong>
              {guide.barangay ? (
                <>
                  {' '}
                  · Focus: <strong>{guide.barangay}</strong>
                </>
              ) : null}
              {' '}
              · Municipal planting target:{' '}
              <strong>
                {guide.municipal.plantingHa.toLocaleString()} ha / {guide.municipal.plantingFarmers} farmers
              </strong>
            </Typography>

            {(planting || harvest || standing) && (
              <Table size="small" sx={{ mb: 2, maxWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Report</TableCell>
                    <TableCell align="right">Farmers</TableCell>
                    <TableCell align="right">Irrigated (ha)</TableCell>
                    <TableCell align="right">Rainfed (ha)</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {planting && (
                    <TableRow>
                      <TableCell>Planting</TableCell>
                      <TableCell align="right">{planting.farmers}</TableCell>
                      <TableCell align="right">{planting.irrigatedHa}</TableCell>
                      <TableCell align="right">{planting.rainfedHa}</TableCell>
                      <TableCell align="right">{planting.totalHa} ha</TableCell>
                    </TableRow>
                  )}
                  {harvest && (
                    <TableRow>
                      <TableCell>Harvest</TableCell>
                      <TableCell align="right">{harvest.farmers}</TableCell>
                      <TableCell align="right">{harvest.irrigatedHa}</TableCell>
                      <TableCell align="right">{harvest.rainfedHa}</TableCell>
                      <TableCell align="right">
                        {harvest.totalHa} ha / {harvest.totalProdMt} MT
                      </TableCell>
                    </TableRow>
                  )}
                  {standing && (
                    <TableRow>
                      <TableCell>Standing (Mar 31, 2026)</TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right">{standing.irrigatedHa}</TableCell>
                      <TableCell align="right">{standing.rainfedHa}</TableCell>
                      <TableCell align="right">{standing.totalHa} ha</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  What you must type (exact values)
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                  <div>Irrigation: {guide.allowedValues.irrigation.join(' / ')}</div>
                  <div>Seed type: {guide.allowedValues.seedType.join(' / ')}</div>
                  <div>Season: {guide.allowedValues.season.join(' / ')}</div>
                  <div>Crop stage: {guide.allowedValues.cropStage.join(' / ')}</div>
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Workflow for Department Head accuracy
                </Typography>
                <List dense disablePadding>
                  {guide.workflow.map((step, i) => (
                    <ListItem key={step} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={`${i + 1}. ${step}`}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </>
        )}
      </Paper>

      <Grid container spacing={2.5}>
        {KINDS.map((k) => (
          <Grid key={k.type} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {k.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 48 }}>
                {k.blurb}
              </Typography>
              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={busy === `tpl-${k.type}` ? <CircularProgress size={16} /> : <Download />}
                  disabled={!!busy}
                  onClick={() => void downloadTemplate(k.type)}
                >
                  Download blank template
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={
                    busy === `filled-${k.type}` ? <CircularProgress size={16} /> : <FactCheck />
                  }
                  disabled={!!busy || (isTechnician && !assigned)}
                  onClick={() => void downloadFilled(k.type)}
                >
                  Download official-aligned fill
                </Button>
                <Button
                  variant="contained"
                  startIcon={
                    busy === `up-${k.type}` ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <UploadFile />
                    )
                  }
                  disabled={!!busy}
                  onClick={() => fileRefs.current[k.type]?.click()}
                  sx={{ background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
                >
                  Upload filled Excel
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={
                    busy === `gen-${k.type}` ? <CircularProgress size={16} /> : <AutoAwesome />
                  }
                  disabled={!!busy}
                  onClick={() => void generatePaper(k.type)}
                >
                  Generate municipal paper
                </Button>
                {isTechnician && (
                  <Typography variant="caption" color="text.secondary">
                    Prefer Department Head to generate the final municipal paper after all barangays upload.
                  </Typography>
                )}
                <input
                  ref={(el) => {
                    fileRefs.current[k.type] = el;
                  }}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(e) => {
                    onFile(k.type, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </Stack>
              {guide?.columns?.[k.type] && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Required columns
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {guide.columns[k.type].join(' · ')}
                  </Typography>
                </>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2.5, mt: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <Description color="primary" />
          <Typography variant="h6" fontWeight="bold">
            How it becomes accurate to the papers
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" component="div">
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Download <strong>official-aligned fill</strong> (totals from DA DS 2026 papers) or start from the blank
              template.
            </li>
            <li>Keep only your barangay rows; irrigation and seed codes must match the allowed values above.</li>
            <li>Upload replaces that barangay’s reports only — other barangays stay intact.</li>
            <li>
              Department Head uses <strong>Generate municipal paper</strong> to rebuild Rizal cumulative totals in the
              same structure as the official papers in <code>data/official/</code>.
            </li>
          </ol>
        </Typography>
      </Paper>

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
