import { useEffect, useState } from 'react';
import { api, BarangayApi, SitioApi } from '../lib/api';

export function useLocations() {
  const [barangays, setBarangays] = useState<BarangayApi[]>([]);
  const [sitios, setSitios] = useState<SitioApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [b, s] = await Promise.all([api.getBarangays(), api.getSitios()]);
      setBarangays(b);
      setSitios(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const getSitiosByBarangayName = (barangayName: string) => {
    const b = barangays.find((x) => x.name === barangayName);
    return b ? sitios.filter((s) => s.barangayId === b.id) : [];
  };

  return { barangays, sitios, loading, error, refresh, getSitiosByBarangayName };
}
