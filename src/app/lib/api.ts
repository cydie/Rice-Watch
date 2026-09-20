const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem('ricewatch_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ricewatch_token', token);
  else localStorage.removeItem('ricewatch_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('text/csv')) {
    return (await res.text()) as T;
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getUsers: () => request<ManagedUser[]>('/auth/users'),

  createUser: (data: CreateUserPayload) =>
    request<{ message: string; user: ManagedUser }>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: UpdateUserPayload) =>
    request<{ message: string; user: ManagedUser }>(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    request<{ success: boolean; message: string }>(`/auth/users/${id}`, {
      method: 'DELETE',
    }),

  forgotPassword: (email: string) =>
    request<{ message: string; demoOtp?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp: string) =>
    request<{ message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),

  me: () => request<{ user: AuthUser }>('/auth/me'),

  getBarangays: () => request<BarangayApi[]>('/barangays'),
  createBarangay: (data: Partial<BarangayApi>) =>
    request<BarangayApi>('/barangays', { method: 'POST', body: JSON.stringify(data) }),
  updateBarangay: (id: number, data: Partial<BarangayApi>) =>
    request<BarangayApi>(`/barangays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBarangay: (id: number) =>
    request<{ success: boolean }>(`/barangays/${id}`, { method: 'DELETE' }),

  getSitios: () => request<SitioApi[]>('/sitios'),
  createSitio: (data: { barangayId: number; name: string; type: string }) =>
    request<SitioApi>('/sitios', { method: 'POST', body: JSON.stringify(data) }),
  updateSitio: (id: number, data: Partial<SitioApi>) =>
    request<SitioApi>(`/sitios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSitio: (id: number) =>
    request<{ success: boolean }>(`/sitios/${id}`, { method: 'DELETE' }),

  getPlantingReports: () => request<PlantingReportApi[]>('/planting-reports'),
  createPlantingReport: (data: PlantingReportPayload) =>
    request<PlantingReportApi>('/planting-reports', { method: 'POST', body: JSON.stringify(data) }),
  updatePlantingReport: (id: number, data: Partial<PlantingReportPayload>) =>
    request<PlantingReportApi>(`/planting-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlantingReport: (id: number) =>
    request<{ success: boolean }>(`/planting-reports/${id}`, { method: 'DELETE' }),

  getHarvestReports: () => request<HarvestReportApi[]>('/harvest-reports'),
  createHarvestReport: (data: HarvestReportPayload) =>
    request<HarvestReportApi>('/harvest-reports', { method: 'POST', body: JSON.stringify(data) }),
  updateHarvestReport: (id: number, data: Partial<HarvestReportPayload>) =>
    request<HarvestReportApi>(`/harvest-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHarvestReport: (id: number) =>
    request<{ success: boolean }>(`/harvest-reports/${id}`, { method: 'DELETE' }),

  getStandingCropReports: () => request<StandingCropApi[]>('/standing-crop-reports'),
  createStandingCropReport: (data: StandingCropPayload) =>
    request<StandingCropApi>('/standing-crop-reports', { method: 'POST', body: JSON.stringify(data) }),
  updateStandingCropReport: (id: number, data: Partial<StandingCropPayload>) =>
    request<StandingCropApi>(`/standing-crop-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStandingCropReport: (id: number) =>
    request<{ success: boolean }>(`/standing-crop-reports/${id}`, { method: 'DELETE' }),

  getDashboard: () => request<DashboardData>('/dashboard'),
  getAnalytics: () => request<AnalyticsData>('/analytics'),
  getMapMetrics: () => request<MapMetricsResponse>('/map/barangay-metrics'),
  getForecast: () => request<ForecastResponse>('/forecast'),
  getAlerts: () => request<AlertsResponse>('/alerts'),
  syncAlertNotifications: () =>
    request<{ message: string; notified: number }>('/alerts/sync-notifications', {
      method: 'POST',
    }),
  exportAlertsCsv: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/alerts/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError('Alert export failed', res.status);
    return res.blob();
  },
  downloadResearchPack: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/export/research-pack`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || 'Research pack failed', res.status);
    }
    return res.blob();
  },
  getNotifications: () => request<NotificationApi[]>('/notifications'),
  markNotificationRead: (id: number) =>
    request<NotificationApi>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' }),

  getFarmers: (params?: { search?: string; barangay?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.barangay) q.set('barangay', params.barangay);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const query = q.toString();
    return request<FarmersListResponse>(`/farmers${query ? `?${query}` : ''}`);
  },
  getFarmerStats: () => request<FarmerStats>('/farmers/stats'),
  getFarmer: (id: number) => request<FarmerApi>(`/farmers/${id}`),

  exportCsv: async (type: string) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/export/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError('Export failed', res.status);
    return res.blob();
  },

  downloadReportTemplate: async (type: 'planting' | 'harvest' | 'standing') => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/reports/templates/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || 'Template download failed', res.status);
    }
    return res.blob();
  },

  getTechnicianGuide: async (barangay?: string) => {
    const q = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    return request<TechnicianGuideApi>(`/reports/technician-guide${q}`);
  },

  downloadFilledTemplate: async (
    type: 'planting' | 'harvest' | 'standing',
    barangay?: string
  ) => {
    const token = getToken();
    const q = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE}/reports/filled-template/${type}${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || 'Filled template download failed', res.status);
    }
    return res.blob();
  },

  uploadReportMasterlist: async (type: 'planting' | 'harvest' | 'standing', file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/reports/upload/${type}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || 'Upload failed', res.status);
    }
    return res.json() as Promise<{
      message: string;
      created: number;
      rows: number;
      barangays: string[];
      barangayScope?: string | null;
    }>;
  },

  generateMunicipalPaper: async (type: 'planting' | 'harvest' | 'standing') => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/reports/generate/${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || 'Generate failed', res.status);
    }
    return res.blob();
  },
};

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  office?: string | null;
  municipality?: string | null;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  office?: string;
  municipality?: string;
  role: string;
  password: string;
}

export interface UpdateUserPayload {
  fullName: string;
  email: string;
  office?: string;
  municipality?: string | null;
  role: string;
  password?: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  office?: string | null;
  municipality?: string | null;
  createdAt?: string;
}

export interface BarangayApi {
  id: number;
  name: string;
  area: number;
  classification: string;
  sitios?: SitioApi[];
}

export interface SitioApi {
  id: number;
  barangayId: number;
  name: string;
  type: 'Sitio' | 'Purok';
}

export interface PlantingReportApi {
  id: number;
  municipality: string;
  barangay: string;
  sitio: string;
  farmerCount: number;
  seedVariety: string;
  areaPlanted: number;
  datePlanted: string;
  irrigationType: string;
  season: string;
  expectedHarvest: string;
}

export type PlantingReportPayload = Omit<PlantingReportApi, 'id'>;

export interface HarvestReportApi {
  id: number;
  municipality: string;
  barangay: string;
  sitio: string;
  harvestDate: string;
  harvestedArea: number;
  totalProduction: number;
  averageYield: number;
  riceVariety: string;
  irrigationType: string;
}

export type HarvestReportPayload = Omit<HarvestReportApi, 'id' | 'averageYield'>;

export interface StandingCropApi {
  id: number;
  municipality: string;
  barangay: string;
  sitio: string;
  cropStage: string;
  area: number;
  cropCondition: string;
  damagedArea: number;
  pestInfestation: string;
  irrigationStatus: string;
  lastUpdated: string;
}

export type StandingCropPayload = Omit<StandingCropApi, 'id' | 'lastUpdated'>;

export interface DashboardData {
  scope?: {
    level: 'municipality' | 'barangay';
    barangay: string | null;
  };
  summary: {
    totalPlantedArea: number;
    totalHarvestedArea: number;
    totalProduction: number;
    averageYield: number;
    farmerCount: number;
    standingArea: number;
    activeReports: number;
    remainingStanding: number;
    harvestCoveragePct: number;
  };
  risks: {
    damagedArea: number;
    pestAlertCount: number;
    irrigationIssues: number;
  };
  coverage: {
    planted: number;
    harvested: number;
    standing: number;
  };
  monthlyProductionData: { month: string; production: number; area: number }[];
  irrigationData: { name: string; value: number; color: string }[];
  cropStageData: { stage: string; count: number }[];
  barangayScoreboard: {
    name: string;
    planted: number;
    harvested: number;
    production: number;
    standing: number;
  }[];
  topBarangays: { name: string; production: number }[];
  topMunicipalities?: { name: string; production: number }[];
  recentActivities: { action: string; location: string; time: string }[];
  lastSyncedAt: string;
}

export interface AnalyticsData {
  scope?: { level: string; barangay: string | null };
  meta: {
    municipality: string;
    province: string;
    dataPeriodLabel: string;
    generatedAt: string;
    recordCounts: { planting: number; harvest: number; standing: number };
  };
  researchMetrics: {
    meanYieldMtHa: number;
    totalPlantedHa: number;
    totalHarvestedHa: number;
    plantedVsHarvestedGapHa: number;
    totalProductionMt: number;
    totalFarmers: number;
    standingAreaHa: number;
    barangayCount: number;
  };
  seasonalData: {
    season: string;
    planted: number;
    harvested: number;
    production: number;
    farmers?: number;
  }[];
  municipalityComparison: {
    name: string;
    planted: number;
    harvested: number;
    yield: number;
    production?: number;
    farmers?: number;
    areaGapHa?: number;
  }[];
  varietyDistribution: { name: string; value: number; color: string }[];
  yieldTrends: {
    year: string;
    period?: string;
    avgYield: number;
    harvestedArea?: number;
    production?: number;
  }[];
  irrigationSplit: {
    type: string;
    planted: number;
    harvested: number;
    production: number;
    yield: number;
  }[];
}

export interface MapBarangayMetric {
  name: string;
  plantedHa: number;
  harvestedHa: number;
  standingHa: number;
  productionMt: number;
  farmers: number;
  irrigatedHa: number;
  rainfedHa: number;
  topVariety: string;
  yieldMtHa: number;
  riskLevel: string;
  riskScore: number;
  riskFlags: string[];
}

export interface MapMetricsResponse {
  scope: { level: string; barangay: string | null };
  municipality: string;
  province: string;
  center: [number, number];
  metricOptions: string[];
  barangays: MapBarangayMetric[];
}

export interface ForecastResponse {
  scope?: { level: string; barangay: string | null };
  model: {
    name: string;
    type: string;
    description: string;
    limitations: string;
    features: string[];
    trainedOn: number;
    holdoutSize: number;
    mae: number;
    mape: number;
    rmse: number;
  };
  municipalityMeanYield: number;
  predictions: {
    barangay: string;
    irrigationType: string;
    varietyClass: string;
    areaHa: number;
    predictedYieldMtHa: number;
    predictedProductionMt: number;
    baselineYieldMtHa: number;
    sampleSize: number;
  }[];
}

export interface AlertsResponse {
  scope: { level: string; barangay: string | null };
  generatedAt: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  alerts: {
    barangay: string;
    score: number;
    severity: string;
    flags: string[];
    damagedAreaHa: number;
    standingAreaHa: number;
    plantedHa: number;
    harvestedHa: number;
  }[];
}

export interface FarmerApi {
  id: number;
  rsbsaNumber: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  fullName: string;
  farmerAddress1: string;
  farmerAddress2: string;
  farmerAddress3: string;
  farmAddress2: string;
  farmAddress3: string;
  birthdate: string | null;
  sex: string;
  contactNo: string;
  fourPs: boolean;
  indigenous: boolean;
  pwd: boolean;
  farmArea: number;
  areaPlanted: number | null;
  commodity: string;
  farmerGeoCode: string | null;
  farmGeoCode: string | null;
  barangay: string;
  barangayId: number | null;
}

export interface FarmersListResponse {
  data: FarmerApi[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface FarmerStats {
  total: number;
  byBarangay: { barangay: string; count: number; totalFarmArea: number }[];
}

export interface TechnicianGuideApi {
  season: string;
  asOf: { planting: string; harvest: string; standing: string };
  barangay?: string;
  barangays?: string[];
  municipal: {
    plantingFarmers: number;
    plantingHa: number;
    harvestFarmers: number;
    harvestHa: number;
    harvestProdMt: number;
    standingHa: number;
  };
  planting?: {
    barangay: string;
    farmers: number;
    irrigatedHa: number;
    rainfedHa: number;
    totalHa: number;
  } | null;
  harvest?: {
    barangay: string;
    farmers: number;
    irrigatedHa: number;
    irrigatedProdMt: number;
    rainfedHa: number;
    rainfedProdMt: number;
    totalHa: number;
    totalProdMt: number;
  } | null;
  standing?: {
    barangay: string;
    irrigatedHa: number;
    rainfedHa: number;
    totalHa: number;
  } | null;
  columns: {
    planting: string[];
    harvest: string[];
    standing: string[];
  };
  allowedValues: {
    irrigation: string[];
    seedType: string[];
    season: string[];
    cropStage: string[];
    cropCondition: string[];
    pest: string[];
  };
  workflow: string[];
}

export interface NotificationApi {
  id: number;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
