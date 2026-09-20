export interface Sitio {
  id: number;
  barangayId: number;
  name: string;
  type: 'Sitio' | 'Purok';
}

export interface Barangay {
  id: number;
  name: string;
  area: number;
  classification: string;
}

export const BARANGAYS: Barangay[] = [
  { id: 1, name: 'Bunog', area: 125.5, classification: 'Irrigated' },
  { id: 2, name: 'Campong Ulay', area: 98.3, classification: 'Irrigated' },
  { id: 3, name: 'Candawaga', area: 75.8, classification: 'Rainfed' },
  { id: 4, name: 'Canipaan', area: 68.2, classification: 'Irrigated' },
  { id: 5, name: 'Culasian', area: 55.4, classification: 'Rainfed' },
  { id: 6, name: 'Iraan', area: 48.9, classification: 'Irrigated' },
  { id: 7, name: 'Latud', area: 42.6, classification: 'Rainfed' },
  { id: 8, name: 'Panalingaan', area: 38.3, classification: 'Irrigated' },
  { id: 9, name: 'Punta Baja (Poblacion)', area: 35.7, classification: 'Rainfed' },
  { id: 10, name: 'Ransang', area: 32.1, classification: 'Irrigated' },
];

export const SITIOS: Sitio[] = [
  // Bunog
  { id: 1, barangayId: 1, name: 'Sitio 1', type: 'Sitio' },
  { id: 2, barangayId: 1, name: 'Sitio 2', type: 'Sitio' },
  { id: 3, barangayId: 1, name: 'Purok 1', type: 'Purok' },

  // Campong Ulay
  { id: 4, barangayId: 2, name: 'Sitio Centro', type: 'Sitio' },
  { id: 5, barangayId: 2, name: 'Purok 1', type: 'Purok' },

  // Candawaga
  { id: 6, barangayId: 3, name: 'Sitio Riverside', type: 'Sitio' },

  // Latud
  { id: 7, barangayId: 7, name: 'Purok 1', type: 'Purok' },
  { id: 8, barangayId: 7, name: 'Purok 2', type: 'Purok' },
];

export function getBarangayById(id: number): Barangay | undefined {
  return BARANGAYS.find(b => b.id === id);
}

export function getBarangayByName(name: string): Barangay | undefined {
  return BARANGAYS.find(b => b.name === name);
}

export function getSitiosByBarangay(barangayId: number): Sitio[] {
  return SITIOS.filter(s => s.barangayId === barangayId);
}

export function getSitiosByBarangayName(barangayName: string): Sitio[] {
  const barangay = getBarangayByName(barangayName);
  return barangay ? getSitiosByBarangay(barangay.id) : [];
}
