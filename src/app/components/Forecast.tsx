import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Skeleton,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
} from '@mui/material';
import {
  pageShellSx,
  pageTitleSx,
  pageSubtitleSx,
  modernCardSx,
  sectionGapSx,
} from '../styles/modernUi';

export function Forecast() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getForecast()
      .then(setData)
      .catch(() => setError('Failed to load yield forecast'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton height={40} width={280} />
        <Skeleton variant="rounded" height={360} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'No forecast data'}</Alert>
      </Box>
    );
  }

  const { model, predictions, municipalityMeanYield } = data;

  return (
    <Box sx={pageShellSx}>
      <Box sx={{ ...sectionGapSx, maxWidth: 720 }}>
        <Typography variant="h4" sx={pageTitleSx}>
          Yield Forecast
        </Typography>
        <Typography sx={pageSubtitleSx}>
          Transparent municipal model for NRS — predictions plus holdout error metrics.
        </Typography>
      </Box>

      <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 }, mb: { xs: 3, md: 4 }, border: '1px solid rgba(46, 125, 50, 0.12)' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Model card
        </Typography>
        <Typography variant="subtitle1">{model.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {model.description}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <Chip label={`MAE ${model.mae} MT/ha`} color="primary" />
          <Chip label={`MAPE ${model.mape}%`} color="primary" />
          <Chip label={`RMSE ${model.rmse}`} />
          <Chip label={`Train n=${model.trainedOn}`} variant="outlined" />
          <Chip label={`Holdout n=${model.holdoutSize}`} variant="outlined" />
          <Chip label={`Municipal mean ${municipalityMeanYield} MT/ha`} color="success" />
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">
          Features: {model.features.join(', ')}
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          {model.limitations}
        </Alert>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ ...modernCardSx, p: { xs: 3, md: 4 } }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Predicted yield by barangay × irrigation × variety class
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Barangay</TableCell>
                  <TableCell>Irrigation</TableCell>
                  <TableCell>Variety class</TableCell>
                  <TableCell align="right">Area (ha)</TableCell>
                  <TableCell align="right">Pred. yield</TableCell>
                  <TableCell align="right">Pred. prod. (MT)</TableCell>
                  <TableCell align="right">Baseline</TableCell>
                  <TableCell align="right">n</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {predictions.map((p) => (
                  <TableRow key={`${p.barangay}-${p.irrigationType}-${p.varietyClass}`}>
                    <TableCell>{p.barangay}</TableCell>
                    <TableCell>{p.irrigationType}</TableCell>
                    <TableCell>{p.varietyClass}</TableCell>
                    <TableCell align="right">{p.areaHa}</TableCell>
                    <TableCell align="right">{p.predictedYieldMtHa}</TableCell>
                    <TableCell align="right">{p.predictedProductionMt}</TableCell>
                    <TableCell align="right">{p.baselineYieldMtHa}</TableCell>
                    <TableCell align="right">{p.sampleSize}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
