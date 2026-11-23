import axios from 'axios';

const getBaseUrl = () => {
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000/api/v1';
  if (API_BASE) return API_BASE;
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000/api/v1';
  return '/api/v1';
};

export const API_BASE_URL = getBaseUrl();

// L2 TB Detection frontend URL — update this if L2 runs on a different port/host
export const L2_FRONTEND_URL = (import.meta as any).env?.VITE_L2_URL || 'http://localhost:5174';

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  error => {
    const url = error.config?.url || '';
    const isAuth = url.includes('/auth/login') || url.includes('/auth/signup');
    if (error.response?.status === 401 && !isAuth && !error.config?._retry) {
      window.dispatchEvent(new CustomEvent('sessionExpired'));
    }
    return Promise.reject(error);
  }
);

export default client;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  email_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SignupRequest {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role?: string;
}

export interface LoginJsonRequest { email: string; password: string; }

export interface DotsCheckin {
  date: string;
  taken: boolean | null;
  note: string;
}

export interface DotsStats {
  pct: number;
  taken: number;
  missed: number;
  consecutive_missed: number;
}

export interface AshaPatient {
  patient_id: string;
  full_name: string;
  age: number;
  sex: string;
  village: string;
  phone: string;
  dots_active: boolean;
  dots_day: number;
  dots_month: number;
  last_checkin: string | null;
  adherence_pct: number;
  today_taken: boolean;
  missed_last_7: number;
  consecutive_missed: number;
  screening_due: boolean;
  tb_risk_level: string | null;
  tb_risk_score: number | null;
  language: string;
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  signup:    (data: SignupRequest)      => client.post<TokenResponse>('/auth/signup', data),
  loginJson: (data: LoginJsonRequest)   => client.post<TokenResponse>('/auth/login-json', data),
  getMe:     ()                         => client.get<User>(`/auth/me?t=${Date.now()}`),
};

// ── Patient Record API ─────────────────────────────────────────────────────────
export interface VoiceCapturePayload   { language: string; voice_transcript: string; }
export interface SymptomAnswersPayload { [key: string]: string; }
export interface TBPredictionPayload {
  record_id: string; risk: string; priority: string; confidence: number;
  risk_score: number; explanation: string[];
}
export interface L2PDFUploadRequest {
  patient_id: string;
  pdf_data: string;
  pdf_name: string;
  report_type?: string;
}

export const patientApi = {
  submitVoiceIntake:    (data: VoiceCapturePayload)   => client.post<{ record_id: string; status: string }>('/patient/voice-intake', data),
  submitSymptomAnswers: (data: SymptomAnswersPayload)  => client.post<{ record_id: string; status: string }>('/patient/symptom-answers', data),
  saveTBPrediction:     (data: TBPredictionPayload)    => client.post('/patient/tb-prediction', data),
  getMyRecords:         ()                             => client.get('/patient/my-records'),
  /** Real DOTS adherence data — replaces Math.random() */
  getMyCheckins:        (days = 30)                    => client.get<{
    grid:     DotsCheckin[];
    checkins: any[];
    stats:    DotsStats;
    days:     number;
  }>(`/patient/my-checkins?days=${days}`),
  getQueueStatus:       ()                             => client.get('/patient/queue-status'),
  /** Check L2 TB Detection referral status */
  getL2Status:          ()                             => client.get('/patient/l2-status'),
  /** Upload L2 PDF report */
  uploadL2PDF:         (data: L2PDFUploadRequest)      => client.post<{
    success: boolean;
    record_id: string;
    pdf_name: string;
    size_kb: number;
    uploaded_at: string;
  }>('/patient/upload-l2-pdf', data),
};

// ── Doctor API ────────────────────────────────────────────────────────────────
export const doctorApi = {
  getQueue:          ()              => client.get('/doctor/queue'),
  getPatient:        (recordId: string) => client.get(`/doctor/patient/${recordId}`),
  getStats:          ()              => client.get('/doctor/stats'),
  saveClinicalAction:(data: any)     => client.post('/doctor/clinical-action', data),
  /** Refer patient to L2 TB Detection — updates patient profile instantly */
  referToL2:         (recordId: string, notes?: string) =>
    client.post(`/doctor/refer-l2/${recordId}`, { notes: notes || '' }),
  /** Download L2 PDF report for a patient */
  downloadL2PDF:     (recordId: string) => client.get<{
    pdf_data: string;
    pdf_name: string;
  }>(`/doctor/patient/${recordId}/download-pdf`),
  /** Save doctor clinical notes to the patient record */
  saveNotes:         (recordId: string, notes: string) =>
    client.post<{ success: boolean; message: string; saved_at: string }>(
      `/doctor/patient/${recordId}/notes`,
      { notes },
    ),
};

// ── Admin API ─────────────────────────────────────────────────────────────────
export const adminApi = {
  getUsers:   ()                  => client.get('/admin/users'),
  getAnalytics: ()                => client.get('/admin/analytics'),
  getPatients:  ()                => client.get('/admin/patients'),
  getPatient:   (recordId: string) => client.get(`/admin/patient/${recordId}`),
};

// ── ASHA API ──────────────────────────────────────────────────────────────────
export const ashaApi = {
  getPatients:      () => client.get('/asha/patients'),
  checkinPatient:   (patientId: string, data: any) => client.post(`/asha/checkin/${patientId}`, data),
  registerPatient:  (data: any) => client.post('/asha/register', data),
  getPatientVisits: (patientId: string) => client.get(`/asha/visits/${patientId}`),
  sendReminder:     (patientId: string, data: any) => client.post(`/asha/reminder/${patientId}`, data),
  updateVitals:     (patientId: string, data: any) => client.post(`/asha/vitals/${patientId}`, data),
};
