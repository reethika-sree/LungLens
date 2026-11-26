import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleBtn } from '../contexts/ThemeContext';
import { patientApi, doctorApi, ashaApi, adminApi, L2_FRONTEND_URL } from '../api/client';
import { useToast } from '../components/ToastProvider';
import './ProfilePage.css';

interface L2Info {
  referred: boolean;
  referred_at?: string;
  referred_by?: string;
  notes?: string;
  pdf_name?: string;
  pdf_uploaded_at?: string;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Per-role data
  const [patientRecords,  setPatientRecords]  = useState<any[]>([]);
  const [l2Info,          setL2Info]          = useState<L2Info>({ referred: false });
  const [pdfUploading,    setPdfUploading]    = useState(false);
  const [doctorStats,     setDoctorStats]     = useState<any>(null);
  const [doctorQueue,     setDoctorQueue]     = useState<any[]>([]);
  const [ashaPatients,    setAshaPatients]    = useState<any[]>([]);
  const [adminAnalytics,  setAdminAnalytics]  = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    if (user.role === 'patient') {
      Promise.all([patientApi.getMyRecords(), patientApi.getL2Status()])
        .then(([rRes, l2Res]) => {
          setPatientRecords((rRes.data as any[]) || []);
          const l2 = l2Res.data as any;
          if (l2?.l2_referred) {
            setL2Info({
              referred:         true,
              referred_at:      l2.l2_referred_at,
              referred_by:      l2.l2_referred_by,
              notes:            l2.l2_referral_notes,
              pdf_name:         l2.l2_pdf_name,
              pdf_uploaded_at:  l2.l2_pdf_uploaded_at,
            });
          }
        })
        .catch(() => showToast('Could not load patient data', 'var(--red)', 'bi-exclamation-triangle'))
        .finally(() => setLoading(false));
    }

    if (user.role === 'doctor') {
      Promise.all([doctorApi.getStats(), doctorApi.getQueue()])
        .then(([sRes, qRes]) => {
          setDoctorStats(sRes.data);
          setDoctorQueue(((qRes.data as any).queue || []).slice(0, 5));
        })
        .catch(() => showToast('Could not load doctor data', 'var(--red)', 'bi-exclamation-triangle'))
        .finally(() => setLoading(false));
    }

    if (user.role === 'asha') {
      ashaApi.getPatients()
        .then(res => setAshaPatients((res.data as any[]) || []))
        .catch(() => showToast('Could not load ASHA data', 'var(--red)', 'bi-exclamation-triangle'))
        .finally(() => setLoading(false));
    }

    if (user.role === 'admin') {
      adminApi.getAnalytics()
        .then(res => setAdminAnalytics(res.data))
        .catch(() => showToast('Could not load admin data', 'var(--red)', 'bi-exclamation-triangle'))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (!user) {
    navigate('/login');
    return null;
  }

  // ── PDF Upload handler ──────────────────────────────────────────────────────
  const handleUploadPDF = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setPdfUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const res = await patientApi.uploadL2PDF({
            patient_id:  user.user_id,
            pdf_data:    base64,
            pdf_name:    file.name,
            report_type: 'patient_upload',
          });
          if (res.data.success) {
            // Update local state so PDF name shows immediately
            setL2Info(prev => ({
              ...prev,
              pdf_name:        res.data.pdf_name,
              pdf_uploaded_at: res.data.uploaded_at,
            }));
            showToast(`✓ "${file.name}" uploaded successfully`, 'var(--green)', 'bi-check-circle-fill');
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Upload error:', err);
        showToast('Upload failed. Please try again.', 'var(--red)', 'bi-exclamation-triangle');
      } finally {
        setPdfUploading(false);
      }
    };
    input.click();
  };

  // ─── Patient Profile ──────────────────────────────────────────────────────
  const renderPatientProfile = () => {
    const lastRecord  = patientRecords[0];
    const totalVisits = patientRecords.length;
    const lastVisitStr = lastRecord
      ? new Date(lastRecord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const latestPriority = lastRecord?.tb_risk_level?.toUpperCase() || '—';
    const latestLanguage = lastRecord?.language || '—';

    return (
      <div className="profile-page">
        <div className="profile-hero-section">
          <div className="profile-hero-content">
            <h1 className="profile-hero-title">Patient Profile</h1>
            <p className="profile-hero-subtitle">Your health records and treatment progress</p>
            <div className="profile-hero-badges">
              <span className="profile-badge profile-badge-primary">
                <i className="bi-heart-pulse-fill" /> Active Patient
              </span>
              <span className="profile-badge profile-badge-secondary">
                <i className="bi-hospital-fill" /> LungLens
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{(user.full_name || 'U')[0].toUpperCase()}</div>
          <div className="profile-main">
            <div className="profile-name">{user.full_name}</div>
            <div className="profile-meta">{user.email}</div>
          </div>
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => navigate('/patient/history')}>View Health Records</button>
            <button className="btn" onClick={() => navigate('/patient/questions')}>New Screening</button>
          </div>
        </div>

        {/* ── L2 Referral Banner ── */}
        {l2Info.referred && (
          <div className="card" style={{ border: '1.5px solid #8b5cf6', background: 'rgba(139,92,246,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'rgba(139,92,246,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi-microscope" style={{ fontSize: 20, color: '#8b5cf6' }} />
              </div>

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: '#8b5cf6', marginBottom: 4 }}>
                  L2 TB Detection Required
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                  Your doctor has referred you for advanced TB detection tests.
                </div>
                {l2Info.referred_by && (
                  <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>
                    <i className="bi-person-fill" style={{ marginRight: 4 }} />
                    Referred by {l2Info.referred_by}
                    {l2Info.referred_at && (
                      <span style={{ marginLeft: 8 }}>
                        &middot; {new Date(l2Info.referred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}

                {/* PDF status row */}
                {l2Info.pdf_name ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    marginTop: 6, padding: '5px 12px', borderRadius: 8,
                    background: 'rgba(62,232,160,0.1)', border: '1px solid rgba(62,232,160,0.3)',
                  }}>
                    <i className="bi-file-earmark-pdf-fill" style={{ color: '#3ee8a0', fontSize: 14 }} />
                    <span style={{ fontSize: 12, color: '#3ee8a0', fontWeight: 600 }}>
                      {l2Info.pdf_name}
                    </span>
                    {l2Info.pdf_uploaded_at && (
                      <span style={{ fontSize: 11, color: 'var(--text4)' }}>
                        &middot; uploaded {new Date(l2Info.pdf_uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 4 }}>
                    <i className="bi-info-circle" style={{ marginRight: 4 }} />
                    No PDF report uploaded yet
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <a
                  href={L2_FRONTEND_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    background: '#8b5cf6', borderColor: '#8b5cf6',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <i className="bi-box-arrow-up-right" /> Open L2 Detection
                </a>
                <button
                  className="btn"
                  onClick={handleUploadPDF}
                  disabled={pdfUploading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {pdfUploading ? (
                    <><i className="bi-hourglass-split" /> Uploading…</>
                  ) : l2Info.pdf_name ? (
                    <><i className="bi-arrow-repeat" /> Replace PDF</>
                  ) : (
                    <><i className="bi-file-earmark-pdf" /> Upload PDF Report</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Screenings</div>
            <div className="stat-value">{loading ? '…' : totalVisits}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Screening</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{loading ? '…' : lastVisitStr}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Latest Priority</div>
            <div className="stat-value">{loading ? '…' : latestPriority}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Language</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{loading ? '…' : latestLanguage}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Screenings</div>
          <div className="activity-list">
            {loading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text4)' }}>Loading…</div>
            ) : patientRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text4)' }}>
                <i className="bi-calendar-x" style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                <div>No screenings yet</div>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/patient/questions')}>
                  Start Screening
                </button>
              </div>
            ) : (
              patientRecords.slice(0, 5).map((rec: any, idx: number) => (
                <div key={rec.record_id || idx} className="activity-item">
                  <div
                    className="activity-dot"
                    style={{
                      background: rec.tb_risk_level === 'high' ? 'var(--red)' :
                                 rec.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--green)',
                    }}
                  />
                  <div className="activity-body">
                    <div className="activity-title">
                      TB Screening — {rec.priority || 'Pending'}
                      {rec.l2_referred && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
                          · L2 Referred
                        </span>
                      )}
                      {rec.l2_pdf_name && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#3ee8a0', fontWeight: 600 }}>
                          <i className="bi-file-earmark-pdf-fill" style={{ marginRight: 3 }} />
                          {rec.l2_pdf_name}
                        </span>
                      )}
                    </div>
                    <div className="activity-date">
                      {new Date(rec.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="activity-detail">
                      Risk: {rec.tb_risk_level?.toUpperCase() || '—'} · Score: {rec.tb_risk_score ?? '—'}%
                      · {rec.language}
                    </div>
                  </div>
                  <div className="activity-status">
                    <span className="tag" style={{
                      background: rec.status === 'prediction_complete' ? 'var(--green)' : 'var(--blue)',
                      color: 'white',
                    }}>
                      {rec.status === 'prediction_complete' ? 'Screened' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Doctor Profile ────────────────────────────────────────────────────────
  const renderDoctorProfile = () => {
    const total   = doctorStats?.total       ?? '—';
    const high    = doctorStats?.high_risk   ?? '—';
    const medium  = doctorStats?.medium_risk ?? '—';
    const pending = doctorStats?.pending     ?? '—';

    return (
      <div className="profile-page">
        <div className="profile-hero-section">
          <div className="profile-hero-content">
            <h1 className="profile-hero-title">Doctor Profile</h1>
            <p className="profile-hero-subtitle">Clinical practice and patient management</p>
            <div className="profile-hero-badges">
              <span className="profile-badge profile-badge-primary">
                <i className="bi-heart-pulse-fill" /> Verified Doctor
              </span>
              <span className="profile-badge profile-badge-secondary">
                <i className="bi-hospital-fill" /> LungLens
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{(user.full_name || 'U')[0].toUpperCase()}</div>
          <div className="profile-main">
            <div className="profile-name">{user.full_name}</div>
            <div className="profile-meta">{user.email} · Medical Officer</div>
          </div>
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => navigate('/doctor/queue')}>View Queue</button>
            <button className="btn" onClick={() => navigate('/doctor/shap')}>SHAP Analysis</button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Patients</div>
            <div className="stat-value">{loading ? '…' : total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">High Risk</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{loading ? '…' : high}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Medium Risk</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{loading ? '…' : medium}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Review</div>
            <div className="stat-value">{loading ? '…' : pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Latest Priority</div>
            <div className="stat-value">{loading ? '…' : (doctorQueue[0]?.priority || '—')}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Patients in Queue</div>
          <div className="patient-list">
            {loading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text4)' }}>Loading…</div>
            ) : doctorQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text4)' }}>
                <i className="bi-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                No patients in queue
              </div>
            ) : (
              doctorQueue.map((p: any, idx: number) => {
                const initials = (p.patient_name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                const riskCol  = p.tb_risk_level === 'high' ? 'var(--red)' :
                                 p.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--green)';
                return (
                  <div
                    key={p.record_id || idx}
                    className="patient-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/doctor/patient?id=${p.record_id}`)}
                  >
                    <div className="patient-avatar">{initials}</div>
                    <div className="patient-info">
                      <div className="patient-name">{p.patient_name}</div>
                      <div className="patient-detail">
                        TB Risk: {p.tb_risk_score}% · {p.priority}
                        {p.l2_referred && <span style={{ color: '#8b5cf6', marginLeft: 6 }}>· L2 Referred</span>}
                        {p.l2_pdf_name && (
                          <span style={{ color: '#3ee8a0', marginLeft: 6 }}>
                            <i className="bi-file-earmark-pdf-fill" style={{ marginRight: 3 }} />
                            PDF uploaded
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="patient-status tag" style={{ background: riskCol + '20', color: riskCol, border: `1px solid ${riskCol}40` }}>
                      {p.tb_risk_level?.charAt(0).toUpperCase() + p.tb_risk_level?.slice(1)} Risk
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── ASHA Profile ──────────────────────────────────────────────────────────
  const renderAshaProfile = () => {
    const totalPatients  = ashaPatients.length;
    const dotsActive     = ashaPatients.filter((p: any) => p.dots_active).length;
    const missedLastWeek = ashaPatients.filter((p: any) => p.missed_last_7 > 0).length;
    const adherentCount  = ashaPatients.filter((p: any) => p.adherence_pct >= 80).length;
    const avgAdherence   = totalPatients > 0
      ? Math.round(ashaPatients.reduce((s: number, p: any) => s + (p.adherence_pct || 0), 0) / totalPatients)
      : 0;

    return (
      <div className="profile-page">
        <div className="profile-hero-section">
          <div className="profile-hero-content">
            <h1 className="profile-hero-title">ASHA Worker Profile</h1>
            <p className="profile-hero-subtitle">Community health outreach and patient follow-up</p>
            <div className="profile-hero-badges">
              <span className="profile-badge profile-badge-primary">
                <i className="bi-house-heart-fill" /> Community Health Worker
              </span>
              <span className="profile-badge profile-badge-secondary">
                <i className="bi-hospital-fill" /> LungLens
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{(user.full_name || 'U')[0].toUpperCase()}</div>
          <div className="profile-main">
            <div className="profile-name">{user.full_name}</div>
            <div className="profile-meta">{user.email} · ASHA Worker</div>
          </div>
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => navigate('/asha/patients')}>View Patients</button>
            <button className="btn" onClick={() => navigate('/asha/dots')}>DOTS Management</button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Assigned Patients</div>
            <div className="stat-value">{loading ? '…' : totalPatients}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">DOTS Compliance</div>
            <div className="stat-value" style={{ color: avgAdherence >= 80 ? 'var(--green)' : 'var(--amber)' }}>
              {loading ? '…' : `${avgAdherence}%`}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active DOTS</div>
            <div className="stat-value">{loading ? '…' : dotsActive}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Need Follow-up</div>
            <div className="stat-value" style={{ color: missedLastWeek > 0 ? 'var(--amber)' : 'var(--green)' }}>
              {loading ? '…' : missedLastWeek}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Active Patient Monitoring</div>
          <div className="patient-list">
            {loading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text4)' }}>Loading…</div>
            ) : ashaPatients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text4)' }}>No patients assigned yet</div>
            ) : (
              ashaPatients.slice(0, 5).map((p: any, idx: number) => {
                const initials = (p.full_name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                const statusColor = p.consecutive_missed >= 2 ? 'var(--red)' : p.missed_last_7 > 0 ? 'var(--amber)' : 'var(--green)';
                const statusLabel = p.consecutive_missed >= 2 ? 'Critical' : p.missed_last_7 > 0 ? 'Follow-up needed' : 'Adherent';
                return (
                  <div key={p.patient_id || idx} className="patient-item">
                    <div className="patient-avatar">{initials}</div>
                    <div className="patient-info">
                      <div className="patient-name">{p.full_name}</div>
                      <div className="patient-detail">
                        {p.dots_active ? `DOTS Day ${p.dots_day}` : 'No active DOTS'} · {p.village}
                        {p.adherence_pct != null && ` · ${p.adherence_pct}% adherence`}
                      </div>
                    </div>
                    <div className="patient-status tag" style={{ background: statusColor + '20', color: statusColor, border: `1px solid ${statusColor}40` }}>
                      {statusLabel}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">DOTS Adherence Summary</div>
          <div className="performance-grid">
            <div className="perf-item">
              <div className="perf-label">Overall Adherence</div>
              <div className="perf-bar"><div className="perf-fill" style={{ width: `${avgAdherence}%`, background: 'var(--green)' }}></div></div>
              <div className="perf-value">{loading ? '…' : `${avgAdherence}%`}</div>
            </div>
            <div className="perf-item">
              <div className="perf-label">Well-Adherent (≥80%)</div>
              <div className="perf-bar">
                <div className="perf-fill" style={{ width: totalPatients > 0 ? `${Math.round((adherentCount / totalPatients) * 100)}%` : '0%', background: 'var(--blue)' }}></div>
              </div>
              <div className="perf-value">
                {loading ? '…' : totalPatients > 0 ? `${Math.round((adherentCount / totalPatients) * 100)}%` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Admin Profile ─────────────────────────────────────────────────────────
  const renderAdminProfile = () => {
    const analytics = adminAnalytics as any;
    return (
      <div className="profile-page">
        <div className="profile-hero-section">
          <div className="profile-hero-content">
            <h1 className="profile-hero-title">Admin Profile</h1>
            <p className="profile-hero-subtitle">System administration and district oversight</p>
            <div className="profile-hero-badges">
              <span className="profile-badge profile-badge-primary"><i className="bi-graph-up-arrow" /> System Administrator</span>
              <span className="profile-badge profile-badge-secondary"><i className="bi-hospital-fill" /> LungLens</span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{(user.full_name || 'U')[0].toUpperCase()}</div>
          <div className="profile-main">
            <div className="profile-name">{user.full_name}</div>
            <div className="profile-meta">{user.email} · System Administrator</div>
            <div className="profile-tags"><span className="tag tag-success">Admin</span></div>
          </div>
          <div className="profile-actions">
          </div>
        </div>

        <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Patients',  val: loading ? '…' : analytics?.total_patients ?? '—', icon: 'bi-people-fill',              color: 'var(--teal)'   },
            { label: 'Total Users',     val: loading ? '…' : analytics?.total_users    ?? '—', icon: 'bi-person-badge-fill',         color: 'var(--purple)' },
            { label: 'High Risk (P1)',  val: loading ? '…' : analytics?.high_risk      ?? '—', icon: 'bi-exclamation-triangle-fill', color: 'var(--red)'    },
            { label: 'Active PHCs',     val: loading ? '…' : analytics?.active_phcs    ?? '5', icon: 'bi-hospital-fill',             color: 'var(--amber)'  },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</span>
                <i className={s.icon} style={{ color: s.color, fontSize: 14 }} />
              </div>
              <div style={{ fontFamily: 'var(--head)', fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>

        {analytics && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text4)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi-bar-chart-fill" style={{ color: 'var(--teal)' }} /> System Overview
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'High Risk Cases',   val: analytics.high_risk   ?? analytics.high_risk_count   ?? 0, color: 'var(--red)',    icon: 'bi-exclamation-triangle-fill', sub: 'Require immediate attention' },
                { label: 'Medium Risk Cases', val: analytics.medium_risk ?? analytics.medium_risk_count ?? 0, color: 'var(--amber)',  icon: 'bi-info-circle-fill',          sub: 'Monitor closely' },
                { label: 'Low Risk Cases',    val: analytics.low_risk    ?? analytics.low_risk_count    ?? 0, color: 'var(--green)',  icon: 'bi-check-circle-fill',         sub: 'Routine follow-up' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg3)', border: `1px solid ${m.color}22`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <i className={m.icon} style={{ color: m.color, fontSize: 13 }} />
                    <span style={{ fontSize: 11, color: 'var(--text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{m.label}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--head)', fontSize: 26, fontWeight: 800, color: m.color, lineHeight: 1, marginBottom: 4 }}>{m.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        
      </div>
    );
  };

  const renderProfile = () => {
    switch (user.role) {
      case 'patient': return renderPatientProfile();
      case 'doctor':  return renderDoctorProfile();
      case 'asha':    return renderAshaProfile();
      case 'admin':   return renderAdminProfile();
      default:        return renderPatientProfile();
    }
  };

  const ROLE_META: Record<string, { color: string; label: string; icon: string }> = {
    doctor:  { color: 'var(--purple)', label: 'PHC Doctor',  icon: 'bi-heart-pulse-fill' },
    patient: { color: 'var(--blue)',   label: 'Patient',     icon: 'bi-person-fill' },
    asha:    { color: 'var(--teal)',   label: 'ASHA Worker', icon: 'bi-house-fill' },
    admin:   { color: 'var(--amber)',  label: 'Admin (NHM)', icon: 'bi-graph-up-arrow' },
  };

  const meta = ROLE_META[user.role];

  return (
    <div className="profile-page-wrapper">
      <header className="profile-header">
        <div className="profile-header-inner">
          <div className="profile-logo" onClick={() => navigate('/')} title="Back to home">
            <div className="profile-logo-icon">
              <i className="bi-lungs-fill" style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <span className="profile-logo-text">Lung<span>Lens</span></span>
          </div>
          <div className="profile-header-right">
            <ThemeToggleBtn />
            <div
              className="profile-avatar-header"
              onClick={() => navigate('/profile')}
              title={`${user?.full_name} — View profile`}
              style={meta ? { background: `linear-gradient(135deg, ${meta.color}, var(--blue))` } : {}}
            >
              {(user?.full_name || 'U')[0].toUpperCase()}
            </div>
            <button className="profile-btn-home" onClick={() => navigate(`/${user.role}`)} title={`${user.role} portal`}>
              <i className="bi-grid-3x3-gap-fill" /><span>Portal</span>
            </button>
            <button className="profile-btn-logout" onClick={() => { logout(); navigate('/'); }} title="Logout">
              <i className="bi-box-arrow-right" /><span>Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="profile-main-content">
        {renderProfile()}
      </main>
    </div>
  );
}