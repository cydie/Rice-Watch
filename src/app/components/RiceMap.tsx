import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Drawer,
  Chip,
  Alert,
  Skeleton,
  Stack,
  Divider,
} from '@mui/material';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { FeatureCollection, Feature } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, MapMetricsResponse, MapBarangayMetric } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { pageShellSx, pageTitleSx, pageSubtitleSx, modernCardSx, sectionGapSx } from '../styles/modernUi';

type MetricKey = 'plantedHa' | 'harvestedHa' | 'standingHa';

function colorScale(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '#e8f5e9';
  const t = Math.min(1, value / max);
  if (t < 0.25) return '#a5d6a7';
  if (t < 0.5) return '#66bb6a';
  if (t < 0.75) return '#43a047';
  return '#1b5e20';
}

export function RiceMap() {
  const { user } = useAuth();
  const assigned = user?.role === 'technician' ? user.municipality : null;
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [metrics, setMetrics] = useState<MapMetricsResponse | null>(null);
  const [metric, setMetric] = useState<MetricKey>('plantedHa');
  const [selected, setSelected] = useState<MapBarangayMetric | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/geo/rizal-barangays.geojson').then((r) => r.json()),
      api.getMapMetrics(),
    ])
      .then(([g, m]) => {
        setGeo(g);
        setMetrics(m);
      })
      .catch(() => setError('Failed to load municipal map'));
  }, []);

  const byName = useMemo(() => {
    const map = new Map<string, MapBarangayMetric>();
    for (const b of metrics?.barangays || []) map.set(b.name, b);
    return map;
  }, [metrics]);

  const maxVal = useMemo(() => {
    const vals = (metrics?.barangays || []).map((b) => b[metric]);
    return Math.max(...vals, 1);
  }, [metrics, metric]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!geo || !metrics) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rounded" height={520} />
      </Box>
    );
  }

  const styleFeature = (feature?: Feature) => {
    const name = String(feature?.properties?.name || '');
    const row = byName.get(name);
    const value = row ? row[metric] : 0;
    const isAssigned = assigned && name === assigned;
    return {
      fillColor: colorScale(value, maxVal),
      weight: isAssigned ? 3 : 1.5,
      opacity: 1,
      color: isAssigned ? '#0d47a1' : '#1b5e20',
      fillOpacity: 0.75,
    };
  };

  const onEach = (feature: Feature, layer: L.Layer) => {
    const name = String(feature.properties?.name || '');
    const row = byName.get(name);
    layer.on({
      click: () => setSelected(row || null),
      mouseover: (e) => {
        const target = e.target as L.Path;
        target.setStyle({ weight: 3, fillOpacity: 0.9 });
      },
      mouseout: (e) => {
        const target = e.target as L.Path;
        target.setStyle(styleFeature(feature));
      },
    });
    if (row) {
      layer.bindTooltip(
        `${name}<br/>${metric}: ${row[metric]} ha<br/>Yield: ${row.yieldMtHa} MT/ha`,
        { sticky: true }
      );
    }
  };

  return (
    <Box sx={pageShellSx}>
      <Box sx={{ ...sectionGapSx, maxWidth: 720 }}>
        <Typography variant="h4" sx={pageTitleSx}>
          Municipal Rice Map
        </Typography>
        <Typography sx={pageSubtitleSx}>
          Rizal, Palawan choropleth from planting / harvest / standing aggregates. Approximate barangay
          polygons for municipal monitoring demo.
        </Typography>
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={metric}
        onChange={(_e, v) => v && setMetric(v)}
        sx={{ mb: 2.5 }}
      >
        <ToggleButton value="plantedHa">Planted (ha)</ToggleButton>
        <ToggleButton value="harvestedHa">Harvested (ha)</ToggleButton>
        <ToggleButton value="standingHa">Standing (ha)</ToggleButton>
      </ToggleButtonGroup>

      {assigned && (
        <Chip color="primary" label={`Technician focus: ${assigned}`} sx={{ mb: 2.5, ml: 1 }} />
      )}

      <Paper sx={{ ...modernCardSx, overflow: 'hidden', height: { xs: 420, md: 560 } }}>
        <MapContainer
          center={metrics.center as [number, number]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            key={metric + (metrics.barangays.length || 0)}
            data={geo}
            style={styleFeature}
            onEachFeature={onEach}
          />
        </MapContainer>
      </Paper>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)}>
        <Box sx={{ width: 320, p: 2.5 }}>
          {selected && (
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight="bold">
                {selected.name}
              </Typography>
              <Chip
                size="small"
                color={
                  selected.riskLevel === 'critical' || selected.riskLevel === 'high'
                    ? 'error'
                    : selected.riskLevel === 'moderate'
                      ? 'warning'
                      : 'success'
                }
                label={`Risk: ${selected.riskLevel} (${selected.riskScore})`}
              />
              <Divider />
              <Typography variant="body2">Planted: {selected.plantedHa} ha</Typography>
              <Typography variant="body2">Harvested: {selected.harvestedHa} ha</Typography>
              <Typography variant="body2">Standing: {selected.standingHa} ha</Typography>
              <Typography variant="body2">Production: {selected.productionMt} MT</Typography>
              <Typography variant="body2">Yield: {selected.yieldMtHa} MT/ha</Typography>
              <Typography variant="body2">Farmers: {selected.farmers}</Typography>
              <Typography variant="body2">
                Irrigation: {selected.irrigatedHa} ha irrigated / {selected.rainfedHa} ha rainfed
              </Typography>
              <Typography variant="body2">Top variety: {selected.topVariety}</Typography>
              {selected.riskFlags.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Flags</Typography>
                  {selected.riskFlags.map((f) => (
                    <Typography key={f} variant="caption" color="text.secondary" display="block">
                      • {f}
                    </Typography>
                  ))}
                </>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
