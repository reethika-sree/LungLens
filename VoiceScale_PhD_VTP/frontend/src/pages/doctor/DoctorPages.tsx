import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import { useModal } from '../../components/ModalProvider';
import { useProcessing } from '../../components/ProcessingProvider';
import AppLayout from '../AppLayout';
import './DoctorPages.css';
import { doctorApi, L2_FRONTEND_URL } from '../../api/client';

// ═══════════════════════════════════════
// LIVE QUEUE
// ═══════════════════════════════════════
const PCOL: Record<string, string> = { P1: 'var(--red)', P2: 'var(--amber)', P3: 'var(--blue)', P4: 'var(--green)' };
const PLBL: Record<string, string> = { P1: 'P1 CRITICAL', P2: 'P2 URGENT', P3: 'P3 MODERATE', P4: 'P4 ROUTINE' };

export function DoctorQueuePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([doctorApi.getQueue(), doctorApi.getStats()]);
      setQueue(qRes.data.queue || []);
      setStats(sRes.data);
    } catch {
      showToast('Could not load queue', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-row">
            <div>
              <div className="vc-ph-title">Live Queue</div>
              <div className="vc-ph-sub">{stats ? `${stats.total} patients · ${stats.high_risk} high risk` : 'Loading…'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="vc-online-pill"><div className="vc-o-dot" /><i className="bi-broadcast" style={{ fontSize: 11 }} /> Live</div>
              <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={fetchQueue}>
                <i className="bi-arrow-clockwise" /> Refresh
              </button>
            </div>
          </div>
        </div>
        <div className="vc-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
              <i className="bi-hourglass-split" style={{ marginRight: 8 }} />Loading patients…
            </div>
          ) : queue.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
              <i className="bi-inbox" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />No patients in queue yet
            </div>
          ) : (
            <table className="queue-table">
              <thead>
                <tr>
                  {['Patient', 'Language', 'TB Score', 'Symptoms +ve', 'Priority', 'Date'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {queue.map((p: any, i: number) => {
                  const pKey = p.priority as string;
                  const col = PCOL[pKey] || 'var(--text4)';
                  return (
                    <tr key={i} className={`qr ${pKey?.toLowerCase()}`}
                        onClick={() => navigate(`/doctor/patient?id=${p.record_id}`)}>
                      <td><div className="pt-name">{p.patient_name}</div></td>
                      <td><div className="pt-sub">{p.language}</div></td>
                      <td>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: col }}>{p.tb_risk_score}%</span>
                        <div className="pt-sub">{p.tb_risk_level?.toUpperCase()}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.symptoms_positive} / 13</td>
                      <td>
                        <span className="vc-badge" style={{ background: `${col}18`, color: col, border: `1px solid ${col}30` }}>
                          <i className={pKey === 'P1' ? 'bi-exclamation-triangle-fill' : 'bi-circle-fill'} style={{ fontSize: 9 }} />
                          {PLBL[pKey] || pKey}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text4)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// SYMPTOM LABELS & ICONS
// ═══════════════════════════════════════
const SYMPTOM_LABELS: Record<string, string> = {
  coughPhlegm: 'Cough with phlegm',
  coughingBlood: 'Coughing blood',
  sputumBlood: 'Blood in sputum',
  shortnessBreath: 'Shortness of breath',
  fever: 'Fever (≥2 weeks)',
  nightSweats: 'Night sweats',
  weightLoss: 'Weight loss',
  tiredBody: 'Fatigue / tiredness',
  chestPain: 'Chest pain',
  backPain: 'Back pain',
  swollenLymph: 'Swollen lymph nodes',
  lumpsArmpitsNeck: 'Lumps in armpits/neck',
  lossAppetite: 'Loss of appetite',
};

const SYMPTOM_ICONS: Record<string, string> = {
  coughPhlegm: 'bi-lungs-fill', coughingBlood: 'bi-droplet-fill', sputumBlood: 'bi-droplet-half',
  shortnessBreath: 'bi-wind', fever: 'bi-thermometer-high', nightSweats: 'bi-moon-stars-fill',
  weightLoss: 'bi-arrow-down-circle', tiredBody: 'bi-battery-half', chestPain: 'bi-heart-pulse',
  backPain: 'bi-person-standing', swollenLymph: 'bi-circle-fill', lumpsArmpitsNeck: 'bi-dot',
  lossAppetite: 'bi-cup-straw',
};

// ═══════════════════════════════════════
// PATIENT DETAIL
// ═══════════════════════════════════════
export function DoctorPatientDetailPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [l2Referred, setL2Referred] = useState(false);
  const [l2Loading, setL2Loading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const audioRef = useRef<SpeechSynthesisUtterance | null>(null);

  const recordId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!recordId) { setLoading(false); return; }
    doctorApi.getPatient(recordId)
      .then(r => {
        setRecord(r.data);
        setL2Referred(!!r.data.l2_referred);
        if (r.data.doctor_notes) {
          setNotes(r.data.doctor_notes);
          setNotesSaved(true);
        }
      })
      .catch(() => showToast('Could not load patient record', 'var(--red)', 'bi-exclamation-triangle'))
      .finally(() => { setLoading(false); setTimeout(() => setAnimated(true), 80); });
  }, [recordId]);

  const linkAbha = () => {
    openModal('Link ABHA ID', 'Connect patient to Ayushman Bharat Digital Mission',
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="vc-alert vc-alert-teal"><i className="bi-info-circle" /> Patient will receive an OTP to verify identity.</div>
        <div className="vc-form-group"><label>Patient phone number</label><input placeholder="+91 98765 43210" /></div>
        <div className="vc-form-group"><label>ABHA number (if known)</label><input placeholder="14-digit ABHA number (optional)" /></div>
      </div>,
      <>
        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}><i className="bi-x" /> Cancel</button>
        <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => { closeModal(); showToast('ABHA link OTP sent to patient', 'var(--teal)', 'bi-phone-fill'); }}>
          <i className="bi-send" /> Send OTP
        </button>
      </>
    );
  };

  const handlePlayTranscript = () => {
    if (!record?.voice_transcript) return;
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const utt = new SpeechSynthesisUtterance(record.voice_transcript);
    utt.lang = 'en-IN';
    utt.onend = () => setPlaying(false);
    audioRef.current = utt;
    window.speechSynthesis.speak(utt);
    setPlaying(true);
  };

  // ── derived values ──
  const answers: Record<string, string> = record?.symptom_answers || {};
  const yesSymptoms = Object.entries(answers).filter(([, v]) => v === 'yes').map(([k]) => k);
  const noSymptoms  = Object.entries(answers).filter(([, v]) => v === 'no').map(([k]) => k);
  const risk        = record?.tb_risk_level || 'low';
  const score       = record?.tb_risk_score ?? 0;
  const conf        = record?.tb_confidence ? Math.round(record.tb_confidence * 100) : 0;
  const priority    = risk === 'high' ? 'P1 CRITICAL' : risk === 'medium' ? 'P2 URGENT' : 'P3 MODERATE';
  const riskCol     = risk === 'high' ? 'var(--red)' : risk === 'medium' ? 'var(--amber)' : 'var(--green)';
  const circumference = 2 * Math.PI * 52;
  const dashOffset    = circumference - (score / 100) * circumference;
  const transcript  = record?.voice_transcript || '';
  const createdAt   = record?.created_at
    ? new Date(record.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  if (loading) {
    return (
      <AppLayout>
        <div className="vc-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ textAlign: 'center', color: 'var(--text4)' }}>
            <i className="bi-hourglass-split" style={{ fontSize: 28, display: 'block', marginBottom: 10 }} />
            Loading patient record…
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!record && !loading) {
    return (
      <AppLayout>
        <div className="vc-page">
          <div className="vc-page-header">
            <div className="vc-ph-title">Patient not found</div>
            <div className="vc-ph-sub">{recordId ? `Record ID: ${recordId}` : 'No record ID in URL'}</div>
          </div>
          <button className="vc-btn vc-btn-ghost" onClick={() => navigate('/doctor/queue')}>
            <i className="bi-arrow-left" /> Back to queue
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="vc-page dp-redesign">

        {/* ══ HERO ══ */}
        <div className="dp-hero">
          <div className="dp-hero-left">
            <div className="dp-avatar"><i className="bi-person-fill" /></div>
            <div>
              <div className="dp-hero-name">{record?.patient_name || 'Patient'}</div>
              <div className="dp-hero-meta">
                <span><i className="bi-calendar3" /> {createdAt}</span>
                <span className="dp-sep" />
                <span><i className="bi-translate" /> {record?.language || 'Unknown'}</span>
                <span className="dp-sep" />
                <span className="dp-record-id">{record?.record_id?.slice(0, 12)}…</span>
              </div>
            </div>
          </div>
          <div className="dp-hero-right">
            <span className="dp-priority-badge" style={{ background: `${riskCol}18`, color: riskCol, border: `1.5px solid ${riskCol}35` }}>
              <i className={risk === 'high' ? 'bi-exclamation-triangle-fill' : 'bi-circle-fill'} />
              {priority}
            </span>
            <button className="dp-back-btn" onClick={() => navigate('/doctor/queue')}>
              <i className="bi-arrow-left" /> Queue
            </button>
          </div>
        </div>

        {/* ══ STATS ROW ══ */}
        <div className="dp-stats-row">
          <div className="dp-stat-card dp-gauge-card">
            <svg width="120" height="120" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="52" fill="none" stroke="var(--dp-track)" strokeWidth="10" />
              <circle cx="65" cy="65" r="52" fill="none" stroke={riskCol} strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={animated ? dashOffset : circumference}
                strokeLinecap="round" transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
              />
              <text x="65" y="61" textAnchor="middle" fontSize="26" fontWeight="800" fill={riskCol} fontFamily="var(--head)">{score}%</text>
              <text x="65" y="78" textAnchor="middle" fontSize="11" fill="var(--dp-text-muted)" fontFamily="var(--body)">TB Risk</text>
            </svg>
            {conf > 0 && <div className="dp-conf-label">{conf}% confidence</div>}
          </div>

          <div className="dp-stat-card dp-sym-stat">
            <div className="dp-sym-num" style={{ color: 'var(--red)' }}>{yesSymptoms.length}</div>
            <div className="dp-sym-label">Present</div>
            <div className="dp-sym-bar-accent" style={{ background: 'var(--red)' }} />
          </div>
          <div className="dp-stat-card dp-sym-stat">
            <div className="dp-sym-num" style={{ color: 'var(--green)' }}>{noSymptoms.length}</div>
            <div className="dp-sym-label">Absent</div>
            <div className="dp-sym-bar-accent" style={{ background: 'var(--green)' }} />
          </div>
          <div className="dp-stat-card dp-sym-stat">
            <div className="dp-sym-num" style={{ color: 'var(--dp-text-muted)' }}>
              {13 - yesSymptoms.length - noSymptoms.length}
            </div>
            <div className="dp-sym-label">Unanswered</div>
            <div className="dp-sym-bar-accent" style={{ background: 'var(--dp-border)', opacity: 0.5 }} />
          </div>

          <div className="dp-stat-card dp-info-card">
            <div className="dp-info-row"><span>Status</span><strong>{record?.status || '—'}</strong></div>
            <div className="dp-info-row"><span>Language</span><strong>{record?.language || '—'}</strong></div>
            <div className="dp-info-row">
              <span>ABHA</span>
              <strong className="dp-link" onClick={linkAbha}>
                Link <i className="bi-box-arrow-up-right" style={{ fontSize: 10 }} />
              </strong>
            </div>
          </div>
        </div>

        {/* ══ MAIN 2-COL GRID ══ */}
        <div className="dp-main-grid">

          {/* ─── LEFT COLUMN ─── */}
          <div className="dp-col-left">

            {/* Voice Transcript */}
            <div className="dp-section">
              <div className="dp-section-header">
                <i className="bi-mic-fill dp-icon-teal" />
                <span>Voice Recording & Transcript</span>
              </div>
              {transcript ? (
                <>
                  <div className="dp-player">
                    <button className={`dp-play-btn ${playing ? 'playing' : ''}`} onClick={handlePlayTranscript}>
                      <i className={playing ? 'bi-stop-fill' : 'bi-play-fill'} />
                    </button>
                    <div className="dp-waveform">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div key={i} className={`dp-wave-bar ${playing ? 'active' : ''}`}
                          style={{
                            height: playing ? `${8 + Math.abs(Math.sin(i * 0.45)) * 16}px` : `${4 + (i % 4) * 3}px`,
                            animationDelay: `${i * 0.04}s`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="dp-lang-tag">{record?.language || '—'}</span>
                  </div>
                  <div className="dp-transcript-box">
                    <div className="dp-transcript-label">
                      <i className="bi-chat-quote-fill" /> Transcribed — {record?.language}
                    </div>
                    {transcript}
                  </div>
                </>
              ) : (
                <div className="dp-empty">
                  <i className="bi-mic-mute" /><span>No voice recording for this record</span>
                </div>
              )}
            </div>

            {/* Symptom Assessment */}
            <div className="dp-section">
              <div className="dp-section-header">
                <i className="bi-clipboard2-pulse dp-icon-purple" />
                <span>Symptom Assessment</span>
              </div>

              {yesSymptoms.length > 0 && (
                <div className="dp-sym-group">
                  <div className="dp-sym-group-label dp-label-red">
                    <i className="bi-exclamation-circle-fill" /> Present ({yesSymptoms.length})
                  </div>
                  <div className="dp-sym-chips">
                    {yesSymptoms.map(k => (
                      <span key={k} className="dp-chip dp-chip-yes">
                        <i className={SYMPTOM_ICONS[k] || 'bi-dot'} />{SYMPTOM_LABELS[k] || k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {noSymptoms.length > 0 && (
                <div className="dp-sym-group">
                  <div className="dp-sym-group-label dp-label-green">
                    <i className="bi-check-circle-fill" /> Absent ({noSymptoms.length})
                  </div>
                  <div className="dp-sym-chips">
                    {noSymptoms.map(k => (
                      <span key={k} className="dp-chip dp-chip-no">
                        <i className="bi-shield-check" />{SYMPTOM_LABELS[k] || k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(answers).length === 0 && (
                <div className="dp-empty"><i className="bi-journal-x" /><span>No symptom answers recorded</span></div>
              )}

              {Object.keys(answers).length > 0 && (
                <div className="dp-sym-bar-wrap">
                  <div className="dp-sym-bar">
                    <div style={{ width: `${(yesSymptoms.length / 13) * 100}%`, background: 'var(--red)', transition: 'width .8s ease' }} />
                    <div style={{ width: `${(noSymptoms.length / 13) * 100}%`, background: 'var(--green)', transition: 'width .8s ease' }} />
                  </div>
                  <div className="dp-sym-legend">
                    <span><span className="dp-dot-sm" style={{ background: 'var(--red)' }} />Present</span>
                    <span><span className="dp-dot-sm" style={{ background: 'var(--green)' }} />Absent</span>
                    <span><span className="dp-dot-sm" style={{ background: 'var(--dp-border)' }} />Unanswered</span>
                  </div>
                </div>
              )}
            </div>

          </div>{/* END dp-col-left */}

          {/* ─── RIGHT COLUMN ─── */}
          <div className="dp-col-right">

            {/* SHAP Risk Breakdown */}
            <div className="dp-section">
              <div className="dp-section-header">
                <i className="bi-bar-chart-steps dp-icon-purple" />
                <span>SHAP Risk Breakdown</span>
                <span className="dp-section-badge" style={{ background: `${riskCol}15`, color: riskCol }}>
                  {score}%
                </span>
              </div>

              {yesSymptoms.length > 0 ? (
                <>
                  <div className="dp-shap-group-label dp-label-red">
                    <i className="bi-arrow-up-circle-fill" /> Increasing risk
                  </div>
                  {yesSymptoms.map((k, i) => (
                    <div key={k} className="dp-shap-row">
                      <div className="dp-shap-lbl">{SYMPTOM_LABELS[k] || k}</div>
                      <div className="dp-shap-track">
                        <div className="dp-shap-fill" style={{
                          width: animated ? `${Math.max(90 - i * 7, 20)}%` : '0%',
                          background: 'var(--red)',
                          transition: `width .7s cubic-bezier(.4,0,.2,1) ${i * 0.06}s`,
                        }} />
                      </div>
                      <div className="dp-shap-val dp-val-red">+YES</div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="dp-empty"><i className="bi-check2-all" /><span>No positive symptoms</span></div>
              )}

              {noSymptoms.length > 0 && (
                <>
                  <div className="dp-shap-divider" />
                  <div className="dp-shap-group-label dp-label-green">
                    <i className="bi-arrow-down-circle-fill" /> Reducing risk
                  </div>
                  {noSymptoms.slice(0, 6).map((k, i) => (
                    <div key={k} className="dp-shap-row">
                      <div className="dp-shap-lbl">{SYMPTOM_LABELS[k] || k}</div>
                      <div className="dp-shap-track">
                        <div className="dp-shap-fill" style={{
                          width: animated ? `${Math.max(42 - i * 6, 8)}%` : '0%',
                          background: 'var(--green)',
                          transition: `width .7s cubic-bezier(.4,0,.2,1) ${i * 0.06}s`,
                        }} />
                      </div>
                      <div className="dp-shap-val dp-val-green">−NO</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* L2 PDF Report */}
            {record?.l2_pdf_name ? (
              <div className="dp-section">
                <div className="dp-section-header">
                  <i className="bi-file-earmark-pdf-fill dp-icon-green" />
                  <span>L2 PDF Report</span>
                  {record.l2_pdf_uploaded_at && (
                    <span className="dp-section-badge" style={{ background: 'var(--dp-green-a)', color: 'var(--green)' }}>
                      {new Date(record.l2_pdf_uploaded_at).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </div>
                <div className="dp-pdf-row">
                  <div className="dp-pdf-icon-wrap"><i className="bi-file-earmark-pdf-fill" /></div>
                  <div className="dp-pdf-info">
                    <div className="dp-pdf-name">{record.l2_pdf_name}</div>
                    <div className="dp-pdf-meta">L2 TB Detection Report</div>
                  </div>
                  <button
                    className="dp-action-pill dp-action-teal"
                    disabled={pdfDownloading}
                    onClick={async () => {
                      if (!recordId) return;
                      setPdfDownloading(true);
                      try {
                        const res = await doctorApi.downloadL2PDF(recordId);
                        const { pdf_data, pdf_name } = res.data;
                        const bytes = atob(pdf_data);
                        const arr = new Uint8Array(bytes.length);
                        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                        const blob = new Blob([arr], { type: 'application/pdf' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = pdf_name; a.click();
                        URL.revokeObjectURL(url);
                        showToast('PDF downloaded', 'var(--green)', 'bi-check2-circle');
                      } catch {
                        showToast('Could not download PDF', 'var(--red)', 'bi-exclamation-triangle');
                      } finally { setPdfDownloading(false); }
                    }}
                  >
                    <i className={pdfDownloading ? 'bi-hourglass-split' : 'bi-download'} />
                    {pdfDownloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="dp-section dp-section-muted">
                <div className="dp-section-header">
                  <i className="bi-file-earmark-pdf" style={{ color: 'var(--dp-text-muted)' }} />
                  <span>L2 PDF Report</span>
                </div>
                <div className="dp-empty">
                  <i className="bi-file-earmark-x" /><span>No L2 PDF report uploaded yet</span>
                </div>
              </div>
            )}

            {/* L2 Referral */}
            <div
              className={`dp-l2-referral ${l2Referred ? 'referred' : ''} ${l2Loading ? 'loading' : ''}`}
              onClick={async () => {
                if (l2Referred || l2Loading || !recordId) return;
                setL2Loading(true);
                try {
                  await doctorApi.referToL2(recordId, 'Referred from L1 screening — high risk');
                  setL2Referred(true);
                  showToast('Patient referred to L2 TB Detection', '#8b5cf6', 'bi-send-fill');
                } catch {
                  showToast('Could not save L2 referral', 'var(--red)', 'bi-exclamation-triangle');
                } finally { setL2Loading(false); }
              }}
            >
              <i className={l2Referred ? 'bi-check2-circle' : l2Loading ? 'bi-hourglass-split' : 'bi-send-fill'} />
              <div>
                <div className="dp-l2-title">
                  {l2Referred ? 'Referred to L2 TB Detection' : l2Loading ? 'Referring…' : 'Refer to L2 TB Detection'}
                </div>
                <div className="dp-l2-sub">
                  {l2Referred ? 'Profile updated · Referral complete' : 'Send patient to Level 2 specialist screening'}
                </div>
              </div>
              {!l2Referred && !l2Loading && <i className="bi-arrow-right dp-l2-arrow" />}
            </div>

            {/* AI Recommendation + Doctor Notes */}
            <div className="dp-section">
              <div className="dp-section-header">
                <i className="bi-robot dp-icon-purple" />
                <span>AI Recommendation</span>
              </div>
              <div className="dp-ai-rec">
                {record?.tb_explanation?.length > 0
                  ? record.tb_explanation.map((e: string, i: number) => (
                    <div key={i} className="dp-ai-item">
                      <span className="dp-ai-num">{i + 1}</span><span>{e}</span>
                    </div>
                  ))
                  : <>
                    <div className="dp-ai-item"><span className="dp-ai-num">1</span><span>Sputum AFB + CXR today at PHC</span></div>
                    <div className="dp-ai-item"><span className="dp-ai-num">2</span><span>GeneXpert at district hospital</span></div>
                    <div className="dp-ai-item"><span className="dp-ai-num">3</span><span>Refer within 24 hrs if positive</span></div>
                    <div className="dp-ai-item"><span className="dp-ai-num">4</span><span>Contact trace household contacts</span></div>
                    <div className="dp-ai-item"><span className="dp-ai-num">5</span><span>WhatsApp reminder to patient</span></div>
                  </>
                }
              </div>
              <div className="dp-notes-label"><i className="bi-pencil-square" /> Doctor Notes</div>
              <textarea
                className="dp-notes-textarea"
                placeholder="Add clinical notes, observations, or reasoning…"
                value={notes}
                readOnly={notesSaved && !notesEditing}
                style={notesSaved && !notesEditing ? { opacity: 0.75, cursor: 'default' } : {}}
                onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
              />
              <div className="dp-notes-actions">
                {notesSaved && !notesEditing ? (
                  <button
                    className="dp-action-pill dp-action-teal"
                    onClick={() => setNotesEditing(true)}
                  >
                    <i className="bi-pencil-fill" /> Edit Notes
                  </button>
                ) : (
                  <button
                    className="dp-action-pill dp-action-teal"
                    disabled={notesSaving}
                    onClick={async () => {
                      if (!recordId) return;
                      setNotesSaving(true);
                      try {
                        await doctorApi.saveNotes(recordId, notes);
                        setNotesSaved(true);
                        setNotesEditing(false);
                        showToast('Clinical notes saved', 'var(--green)', 'bi-check2');
                      } catch {
                        showToast('Could not save notes', 'var(--red)', 'bi-exclamation-triangle');
                      } finally {
                        setNotesSaving(false);
                      }
                    }}
                  >
                    <i className={notesSaving ? 'bi-hourglass-split' : 'bi-floppy2-fill'} />
                    {notesSaving ? 'Saving…' : 'Save Notes'}
                  </button>
                )}
              </div>
            </div>

          </div>{/* END dp-col-right */}

        </div>{/* END dp-main-grid */}

      </div>{/* END vc-page dp-redesign */}

      <style>{`
        /* ── DESIGN TOKENS — dark (default) ── */
        .dp-redesign {
          --dp-surface:     var(--bg2, #0f1a2b);
          --dp-surface2:    var(--bg3, #0a1220);
          --dp-border:      var(--border, #1e2a3a);
          --dp-text1:       var(--text1, #f0f6ff);
          --dp-text2:       var(--text2, #c8d8f0);
          --dp-text3:       var(--text3, #8899b8);
          --dp-text-muted:  var(--text4, #4a5c7a);
          --dp-track:       var(--bg3, #0a1220);
          --dp-green-a:     rgba(62,232,160,.12);
          --dp-purple-a:    rgba(139,92,246,.15);
          --dp-shadow:      0 1px 8px rgba(0,0,0,.3);
        }

        /* ── DESIGN TOKENS — light ── */
        @media (prefers-color-scheme: light) {
          .dp-redesign {
            --dp-surface:     #ffffff;
            --dp-surface2:    #f3f6fb;
            --dp-border:      #dde4ef;
            --dp-text1:       #0f172a;
            --dp-text2:       #334155;
            --dp-text3:       #64748b;
            --dp-text-muted:  #94a3b8;
            --dp-track:       #e2e8f0;
            --dp-green-a:     rgba(16,185,129,.1);
            --dp-purple-a:    rgba(139,92,246,.1);
            --dp-shadow:      0 1px 6px rgba(0,0,0,.07);
          }
        }

        /* ── Shell ── */
        .dp-redesign {
          font-family: var(--body, 'DM Sans', sans-serif);
          max-width: 1200px;
          margin: 0 auto;
          color: var(--dp-text2);
        }

        /* ── Hero ── */
        .dp-hero {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
          margin-bottom: 20px; padding-bottom: 20px;
          border-bottom: 1px solid var(--dp-border);
        }
        .dp-hero-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .dp-avatar {
          width: 50px; height: 50px; border-radius: 14px;
          background: var(--dp-purple-a);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; color: var(--purple, #8b5cf6); flex-shrink: 0;
        }
        .dp-hero-name {
          font-size: 20px; font-weight: 800;
          font-family: var(--head, 'Syne', sans-serif);
          color: var(--dp-text1); line-height: 1.2;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dp-hero-meta {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          font-size: 12px; color: var(--dp-text-muted); margin-top: 3px;
        }
        .dp-sep { width: 3px; height: 3px; border-radius: 50%; background: var(--dp-border); flex-shrink: 0; }
        .dp-record-id { font-family: var(--mono, monospace); font-size: 11px; }
        .dp-hero-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
        .dp-priority-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; letter-spacing: .6px;
          text-transform: uppercase; padding: 6px 14px; border-radius: 20px;
        }
        .dp-back-btn {
          background: var(--dp-surface); border: 1px solid var(--dp-border);
          color: var(--dp-text3); font-size: 12px; padding: 6px 14px;
          border-radius: 8px; cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          transition: border-color .2s, color .2s;
        }
        .dp-back-btn:hover { border-color: var(--dp-text-muted); color: var(--dp-text1); }

        /* ── Stats row ── */
        .dp-stats-row {
          display: grid;
          grid-template-columns: auto 1fr 1fr 1fr 1.5fr;
          gap: 12px; margin-bottom: 20px; align-items: stretch;
        }
        @media (max-width: 960px) {
          .dp-stats-row { grid-template-columns: repeat(3, 1fr); }
          .dp-gauge-card { grid-column: 1 / -1; flex-direction: row; gap: 20px; justify-content: center; }
        }
        @media (max-width: 560px) {
          .dp-stats-row { grid-template-columns: repeat(2, 1fr); }
          .dp-gauge-card { grid-column: 1 / -1; }
          .dp-info-card { grid-column: 1 / -1; }
        }
        .dp-stat-card {
          background: var(--dp-surface);
          border: 1px solid var(--dp-border);
          border-radius: 14px; box-shadow: var(--dp-shadow);
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; padding: 16px;
        }
        .dp-gauge-card { padding: 16px 20px; }
        .dp-conf-label { font-size: 11px; color: var(--dp-text-muted); margin-top: 4px; }
        .dp-sym-stat { gap: 4px; }
        .dp-sym-num { font-size: 34px; font-weight: 800; font-family: var(--head); line-height: 1; }
        .dp-sym-label { font-size: 11px; color: var(--dp-text-muted); text-transform: uppercase; letter-spacing: .5px; }
        .dp-sym-bar-accent { height: 3px; border-radius: 2px; margin-top: 8px; width: 100%; }
        .dp-info-card { align-items: flex-start; justify-content: center; gap: 8px; padding: 16px 20px; }
        .dp-info-row { display: flex; justify-content: space-between; width: 100%; font-size: 12px; gap: 8px; }
        .dp-info-row span { color: var(--dp-text-muted); }
        .dp-info-row strong { color: var(--dp-text1); font-weight: 600; text-align: right; }
        .dp-link { color: var(--amber, #f59e0b) !important; cursor: pointer; }
        .dp-link:hover { text-decoration: underline; }

        /* ── Main grid ── */
        .dp-main-grid {
          display: grid; grid-template-columns: 1fr 360px;
          gap: 16px; align-items: start;
        }
        @media (max-width: 1040px) { .dp-main-grid { grid-template-columns: 1fr; } }
        .dp-col-left, .dp-col-right { display: flex; flex-direction: column; gap: 14px; }

        /* ── Section card ── */
        .dp-section {
          background: var(--dp-surface);
          border: 1px solid var(--dp-border);
          border-radius: 16px; padding: 18px 20px;
          box-shadow: var(--dp-shadow);
        }
        .dp-section-muted { opacity: .72; }
        .dp-section-header {
          display: flex; align-items: center; gap: 8px;
          font-size: 11.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .6px; color: var(--dp-text3); margin-bottom: 14px;
        }
        .dp-section-badge {
          margin-left: auto; font-size: 11px; padding: 3px 10px;
          border-radius: 10px; font-weight: 700;
        }
        .dp-icon-teal   { color: var(--teal,   #0ee6b7); }
        .dp-icon-purple { color: var(--purple, #8b5cf6); }
        .dp-icon-green  { color: var(--green,  #3ee8a0); }
        @media (prefers-color-scheme: light) {
          .dp-icon-green { color: #059669; }
        }

        /* ── Voice player ── */
        .dp-player {
          display: flex; align-items: center; gap: 12px;
          background: var(--dp-surface2); border: 1px solid var(--dp-border);
          border-radius: 12px; padding: 10px 14px; margin-bottom: 10px;
        }
        .dp-play-btn {
          width: 36px; height: 36px; border-radius: 10px;
          background: var(--teal, #0ee6b7); border: none; cursor: pointer;
          color: #000; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: transform .15s;
        }
        .dp-play-btn:hover { transform: scale(1.07); }
        .dp-play-btn.playing { background: var(--red, #ef4444); color: #fff; }
        .dp-waveform { flex: 1; display: flex; align-items: center; gap: 2px; height: 28px; }
        .dp-wave-bar {
          width: 2.5px; border-radius: 2px; flex-shrink: 0;
          background: var(--dp-border); opacity: .6; transition: height .18s ease;
        }
        .dp-wave-bar.active {
          background: var(--teal, #0ee6b7); opacity: .9;
          animation: dp-wave 1s ease-in-out infinite;
        }
        @keyframes dp-wave { 0%,100% { opacity:.5; } 50% { opacity:1; } }
        .dp-lang-tag { font-size: 10px; color: var(--dp-text-muted); flex-shrink: 0; }
        .dp-transcript-box {
          background: var(--dp-surface2); border: 1px solid var(--dp-border);
          border-left: 3px solid var(--teal, #0ee6b7);
          border-radius: 10px; padding: 14px;
          font-size: 13.5px; line-height: 1.8;
          color: var(--dp-text2); max-height: 180px; overflow-y: auto;
        }
        .dp-transcript-label {
          font-size: 10px; font-weight: 700; color: var(--teal, #0ee6b7);
          text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px;
        }

        /* ── Symptoms ── */
        .dp-sym-group { margin-bottom: 12px; }
        .dp-sym-group-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .5px; margin-bottom: 8px;
          display: flex; align-items: center; gap: 5px;
        }
        .dp-label-red   { color: var(--red,   #ef4444); }
        .dp-label-green { color: var(--green, #3ee8a0); }
        @media (prefers-color-scheme: light) { .dp-label-green { color: #059669; } }
        .dp-sym-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .dp-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;
        }
        .dp-chip-yes {
          background: rgba(239,68,68,.1); color: var(--red, #ef4444);
          border: 1px solid rgba(239,68,68,.2);
        }
        .dp-chip-no {
          background: rgba(62,232,160,.08); color: var(--green, #3ee8a0);
          border: 1px solid rgba(62,232,160,.15);
        }
        @media (prefers-color-scheme: light) {
          .dp-chip-no { background: rgba(5,150,105,.08); color: #059669; border-color: rgba(5,150,105,.2); }
        }
        .dp-sym-bar-wrap { margin-top: 14px; }
        .dp-sym-bar {
          height: 6px; background: var(--dp-track);
          border-radius: 3px; overflow: hidden; display: flex; margin-bottom: 6px;
        }
        .dp-sym-legend { display: flex; gap: 14px; font-size: 10px; color: var(--dp-text-muted); }
        .dp-sym-legend span { display: flex; align-items: center; gap: 4px; }
        .dp-dot-sm { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }

        /* ── SHAP ── */
        .dp-shap-group-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .5px; margin-bottom: 10px;
          display: flex; align-items: center; gap: 5px;
        }
        .dp-shap-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .dp-shap-lbl {
          font-size: 11px; color: var(--dp-text3);
          min-width: 128px; max-width: 128px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dp-shap-track {
          flex: 1; height: 6px; background: var(--dp-track);
          border-radius: 3px; overflow: hidden;
        }
        .dp-shap-fill { height: 100%; border-radius: 3px; }
        .dp-shap-val {
          font-size: 10px; font-weight: 700; min-width: 34px;
          text-align: right; font-family: var(--mono, monospace);
        }
        .dp-val-red   { color: var(--red,   #ef4444); }
        .dp-val-green { color: var(--green, #3ee8a0); }
        @media (prefers-color-scheme: light) { .dp-val-green { color: #059669; } }
        .dp-shap-divider { height: 1px; background: var(--dp-border); margin: 12px 0; }

        /* ── PDF ── */
        .dp-pdf-row {
          display: flex; align-items: center; gap: 12px;
          background: var(--dp-surface2); border: 1px solid var(--dp-green-a);
          border-radius: 12px; padding: 12px 14px;
        }
        .dp-pdf-icon-wrap {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--dp-green-a);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; color: var(--green, #3ee8a0); flex-shrink: 0;
        }
        @media (prefers-color-scheme: light) { .dp-pdf-icon-wrap { color: #059669; } }
        .dp-pdf-info { flex: 1; min-width: 0; }
        .dp-pdf-name {
          font-size: 13px; font-weight: 600; color: var(--dp-text1);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dp-pdf-meta { font-size: 11px; color: var(--dp-text-muted); margin-top: 2px; }

        /* ── L2 Referral ── */
        .dp-l2-referral {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 14px; cursor: pointer;
          background: rgba(139,92,246,.08);
          border: 1.5px solid rgba(139,92,246,.28);
          color: #a78bfa;
          transition: background .2s, border-color .2s, transform .15s;
        }
        .dp-l2-referral:hover:not(.referred):not(.loading) {
          background: rgba(139,92,246,.14);
          border-color: rgba(139,92,246,.5);
          transform: translateY(-1px);
        }
        .dp-l2-referral > i { font-size: 22px; flex-shrink: 0; }
        .dp-l2-referral.referred {
          background: var(--dp-green-a);
          border-color: rgba(62,232,160,.3);
          color: var(--green, #3ee8a0); cursor: default;
        }
        .dp-l2-referral.loading { opacity: .6; cursor: wait; }
        .dp-l2-title { font-size: 13px; font-weight: 700; }
        .dp-l2-sub { font-size: 11px; opacity: .7; margin-top: 2px; }
        .dp-l2-arrow { margin-left: auto; font-size: 18px; opacity: .6; }
        @media (prefers-color-scheme: light) {
          .dp-l2-referral { background: rgba(139,92,246,.05); }
          .dp-l2-referral.referred { color: #059669; }
        }

        /* ── Action Pills ── */
        .dp-action-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 9px; font-size: 12px;
          font-weight: 600; cursor: pointer; border: 1px solid transparent;
          transition: opacity .2s, transform .15s; background: none;
        }
        .dp-action-pill:hover { opacity: .82; transform: translateY(-1px); }
        .dp-action-pill:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .dp-action-teal {
          background: rgba(14,230,183,.12); color: var(--teal, #0ee6b7);
          border-color: rgba(14,230,183,.25);
        }
        .dp-action-ghost {
          background: var(--dp-surface2); color: var(--dp-text3);
          border-color: var(--dp-border);
        }
        @media (prefers-color-scheme: light) {
          .dp-action-teal { background: rgba(5,150,105,.1); color: #059669; border-color: rgba(5,150,105,.25); }
        }

        /* ── AI Rec ── */
        .dp-ai-rec {
          background: var(--dp-surface2); border: 1px solid var(--dp-border);
          border-left: 3px solid var(--purple, #8b5cf6);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .dp-ai-item { display: flex; gap: 10px; font-size: 13px; color: var(--dp-text2); line-height: 1.6; }
        .dp-ai-num {
          min-width: 20px; height: 20px; border-radius: 6px;
          background: var(--dp-purple-a); color: var(--purple, #8b5cf6);
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }

        /* ── Notes ── */
        .dp-notes-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .5px; color: var(--dp-text-muted); margin-bottom: 8px;
          display: flex; align-items: center; gap: 5px;
        }
        .dp-notes-textarea {
          width: 100%; height: 88px; resize: none;
          background: var(--dp-surface2); border: 1px solid var(--dp-border);
          border-radius: 10px; padding: 10px 12px;
          font-size: 13px; color: var(--dp-text2); font-family: var(--body);
          line-height: 1.6; box-sizing: border-box; transition: border-color .2s;
        }
        .dp-notes-textarea::placeholder { color: var(--dp-text-muted); }
        .dp-notes-textarea:focus { outline: none; border-color: var(--teal, #0ee6b7); }
        .dp-notes-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

        /* ── Empty state ── */
        .dp-empty {
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 8px; padding: 22px 0;
          color: var(--dp-text-muted); font-size: 13px;
        }
        .dp-empty i { font-size: 26px; opacity: .45; }

        /* ── Tight mobile ── */
        @media (max-width: 480px) {
          .dp-hero-name { font-size: 16px; }
          .dp-section { padding: 14px 14px; }
          .dp-shap-lbl { min-width: 90px; max-width: 90px; }
          .dp-main-grid, .dp-stats-row { gap: 10px; }
        }
      `}</style>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// CLINICAL ACTION
// ═══════════════════════════════════════
export function DoctorActionPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();
  const [approved, setApproved] = useState(false);
  const [ordered, setOrdered] = useState<Record<string, boolean>>({});

  const orderTest = (key: string, name: string) => {
    setOrdered(p => ({ ...p, [key]: true }));
    showToast(`${name} ordered`, 'var(--teal)', 'bi-flask');
  };

  const tests = [
    { key: 'sputum', name: 'Sputum AFB', icon: 'bi-droplet-fill', primary: true },
    { key: 'cxr', name: 'CXR today', icon: 'bi-activity' },
    { key: 'genexpert', name: 'GeneXpert', icon: 'bi-diagram-2-fill' },
    { key: 'blood', name: 'Blood panel', icon: 'bi-plus-circle-fill' },
    {
      key: 'prescribe', name: 'Prescribe', icon: 'bi-capsule',
      action: () => openModal('Prescribe medication', 'AI-drafted plan — your approval legally activates it',
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="vc-alert vc-alert-amber"><i className="bi-exclamation-triangle-fill" /> NMC Act — only licensed doctors may prescribe.</div>
          <div className="vc-form-group"><label>Medication</label>
            <select><option>Isoniazid (INH) 300mg</option><option>Rifampicin 600mg</option><option>Pyrazinamide 1500mg</option></select>
          </div>
          <div className="vc-form-group"><label>Duration</label>
            <select><option>6 months — DOTS standard</option><option>18–24 months — MDR-TB regimen</option></select>
          </div>
        </div>,
        <><button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}><i className="bi-x" /> Cancel</button>
          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => { closeModal(); showToast('Medication plan approved', 'var(--green)', 'bi-capsule'); }}><i className="bi-check2" /> Approve</button></>
      )
    },
    { key: 'trace', name: 'Contact trace', icon: 'bi-diagram-3', action: () => navigate('/doctor/trace') },
    { key: 'tele', name: 'Teleconsult', icon: 'bi-camera-video', action: () => navigate('/doctor/tele') },
    {
      key: 'emerg', name: 'Emergency ref', icon: 'bi-alarm-fill', danger: true,
      action: () => openModal('Emergency referral', 'P1 Critical — immediate district hospital transfer',
        <div className="vc-alert vc-alert-red"><i className="bi-exclamation-octagon-fill" /> This will immediately alert the district hospital.</div>,
        <><button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}><i className="bi-x" /> Cancel</button>
          <button className="vc-btn vc-btn-red vc-btn-sm" onClick={() => { closeModal(); showToast('Emergency referral sent', '#ef4444', 'bi-alarm-fill'); }}><i className="bi-send-fill" /> Send emergency referral</button></>
      )
    },
  ];

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-title">Clinical Action</div>
          <div className="vc-ph-sub">Ramesh K., 45M · P1 Critical · TB risk 78%</div>
        </div>
        <div className="action-grid-layout">
          <div>
            <div className="vc-card" style={{ marginBottom: 14 }}>
              <div className="vc-sec-title"><i className="bi-clipboard2-check" /> Triage decision</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className="vc-btn vc-btn-teal vc-btn-sm" style={{ background: approved ? 'var(--green)' : undefined }}
                  onClick={() => { setApproved(true); showToast('P1 triage confirmed — Ramesh K.', 'var(--green)', 'bi-check-circle-fill'); }}>
                  <i className="bi-check-lg" /> {approved ? 'P1 Approved' : 'Approve P1'}
                </button>
                <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('Override modal', 'var(--purple)', 'bi-pencil-fill')}>
                  <i className="bi-pencil-fill" /> Override priority
                </button>
              </div>
              <div className="vc-sec-title"><i className="bi-grid-fill" /> Order tests &amp; actions</div>
              <div className="action-test-grid">
                {tests.map(t => (
                  <button key={t.key}
                    className={`action-test-btn ${(t as any).danger ? 'danger' : ''} ${t.primary ? 'primary' : ''} ${ordered[t.key] ? 'ordered' : ''}`}
                    onClick={() => (t as any).action ? (t as any).action() : orderTest(t.key, t.name)}>
                    <i className={ordered[t.key] ? 'bi-check2-circle' : t.icon} style={{ fontSize: 18 }} />
                    {ordered[t.key] ? '✓ Ordered' : t.name}
                  </button>
                ))}
                <button
                  className={`action-test-btn ${ordered['l2'] ? 'ordered' : 'primary'}`}
                  style={{
                    gridColumn: '1 / -1',
                    background: ordered['l2'] ? 'var(--green-a, rgba(62,232,160,0.12))' : 'rgba(139,92,246,0.12)',
                    borderColor: ordered['l2'] ? 'var(--green)' : '#8b5cf6',
                    color: ordered['l2'] ? 'var(--green)' : '#8b5cf6',
                  }}
                  onClick={() => {
                    if (ordered['l2']) return;
                    setOrdered(p => ({ ...p, l2: true }));
                    showToast('Patient referred to L2 TB Detection — profile updated', '#8b5cf6', 'bi-send-fill');
                  }}
                >
                  <i className={ordered['l2'] ? 'bi-check2-circle' : 'bi-send-fill'} style={{ fontSize: 18 }} />
                  {ordered['l2'] ? '✓ Referred to L2 TB Detection' : 'Refer to L2 TB Detection'}
                </button>
              </div>
            </div>
          </div>
          <div className="vc-card">
            <div className="vc-sec-title"><i className="bi-robot" /> AI agent recommendation</div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.9, borderLeft: '3px solid var(--purple)', color: 'var(--text2)', marginBottom: 16 }}>
              1. Sputum AFB + CXR today at PHC<br />
              2. GeneXpert at district hospital<br />
              3. Refer within 24 hrs if positive<br />
              4. Contact trace 3 household contacts<br />
              5. WhatsApp reminder to patient
            </div>
            <div className="vc-sec-title"><i className="bi-pencil-square" /> Doctor notes</div>
            <textarea style={{ height: 100, resize: 'none', width: '100%' }} placeholder="Add clinical notes, observations, or reasoning…" />
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="vc-btn vc-btn-teal vc-btn-sm" style={{ flex: 1 }} onClick={() => showToast('Clinical notes saved', 'var(--green)', 'bi-check2')}>
                <i className="bi-floppy2-fill" /> Save notes
              </button>
              <button className="vc-btn vc-btn-purple vc-btn-sm" onClick={() => navigate('/doctor/referral')}><i className="bi-file-earmark-medical" /></button>
              <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => navigate('/doctor/queue')}><i className="bi-arrow-left" /></button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// TELECONSULT
// ═══════════════════════════════════════
export function DoctorTelePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();
  const [seconds, setSeconds] = useState(252);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const endCall = () => {
    openModal('End teleconsult?', 'This will disconnect the video call with the patient.',
      <div className="vc-alert vc-alert-amber"><i className="bi-exclamation-triangle-fill" /> Make sure you have saved all notes before ending.</div>,
      <><button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}><i className="bi-telephone" /> Keep connected</button>
        <button className="vc-btn vc-btn-red vc-btn-sm" onClick={() => { closeModal(); showToast('Teleconsult ended', '#ef4444', 'bi-telephone-x-fill'); }}><i className="bi-telephone-x-fill" /> End call</button></>
    );
  };

  const controls = [
    { icon: micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill', active: micOn, action: () => { setMicOn(m => !m); showToast(micOn ? 'Microphone muted' : 'Microphone on', micOn ? '#ff7070' : 'var(--teal)', micOn ? 'bi-mic-mute-fill' : 'bi-mic-fill'); } },
    { icon: camOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill', active: camOn, action: () => { setCamOn(c => !c); showToast(camOn ? 'Camera off' : 'Camera on', camOn ? '#ff7070' : 'var(--teal)', 'bi-camera-video'); } },
    { icon: 'bi-display', active: false, action: () => showToast('Screen share started', 'var(--teal)', 'bi-display') },
    { icon: 'bi-chat-dots-fill', active: false, action: () => showToast('In-call chat opened', 'var(--teal)', 'bi-chat-dots') },
    { icon: 'bi-record-circle', active: false, action: () => showToast('Recording started', 'var(--teal)', 'bi-record-circle') },
    { icon: 'bi-telephone-x-fill', danger: true, active: false, action: endCall },
  ];

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-row">
            <div>
              <div className="vc-ph-title">Teleconsult</div>
              <div className="vc-ph-sub">Lakshmi D., 32F · P1 Critical · Breathlessness + fever</div>
            </div>
            <div className="vc-online-pill"><div className="vc-o-dot" /><i className="bi-wifi" style={{ fontSize: 11 }} /> Connected</div>
          </div>
        </div>
        <div className="tele-grid">
          <div>
            <div className="video-frame">
              <i className="bi-camera-video-fill" style={{ fontSize: 48, color: 'var(--text4)', opacity: .3 }} />
              <div style={{ fontSize: 13, color: 'var(--text4)' }}>Patient video feed — Lakshmi D.</div>
              <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>HD connected · 32ms latency</div>
              <div className="vid-timer">
                <i className="bi-record-circle-fill" style={{ fontSize: 10, color: 'var(--red)', marginRight: 4 }} />{fmt(seconds)}
              </div>
            </div>
            <div className="vid-controls">
              {controls.map((c, i) => (
                <button key={i} className={`vid-btn ${(c as any).danger ? 'danger' : c.active ? 'active' : ''}`} onClick={c.action}>
                  <i className={c.icon} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="vc-card">
              <div className="vc-sec-title"><i className="bi-person-fill" /> Patient</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--purple-a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="bi-person-fill" style={{ color: 'var(--purple)', fontSize: 18 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Lakshmi D.</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>32F · Hindi · P1 Critical</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span className="vc-tag vc-tag-red"><i className="bi-lungs" /> Breathlessness</span>
                <span className="vc-tag vc-tag-amber"><i className="bi-thermometer-high" /> Fever 5 days</span>
                <span className="vc-tag vc-tag-amber"><i className="bi-heart-pulse" /> SpO2 92%</span>
              </div>
            </div>
            <div className="vc-card">
              <div className="vc-sec-title"><i className="bi-activity" /> TB risk score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontFamily: 'var(--head)', fontSize: 40, fontWeight: 800, color: 'var(--amber)', letterSpacing: -1 }}>42%</div>
                <div>
                  <span className="vc-badge vc-badge-p2">MODERATE</span>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>GeneXpert recommended</div>
                </div>
              </div>
            </div>
            <div className="vc-card">
              <div className="vc-sec-title"><i className="bi-lightning-charge-fill" /> Quick actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Order Sputum AFB', icon: 'bi-droplet-fill', action: () => showToast('Sputum AFB ordered', 'var(--teal)', 'bi-flask') },
                  { label: 'Order GeneXpert', icon: 'bi-diagram-2-fill', action: () => showToast('GeneXpert ordered', 'var(--teal)', 'bi-flask') },
                  { label: 'Generate referral', icon: 'bi-file-earmark-medical', action: () => navigate('/doctor/referral') },
                  { label: 'Contact tracing', icon: 'bi-diagram-3', action: () => navigate('/doctor/trace') },
                ].map(a => (
                  <button key={a.label} className="vc-btn vc-btn-ghost vc-btn-sm" onClick={a.action}>
                    <i className={a.icon} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// SHAP DETAIL PAGE (stub — redirects to queue)
// ═══════════════════════════════════════
export function DoctorShapPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/doctor/queue', { replace: true }); }, []);
  return null;
}
