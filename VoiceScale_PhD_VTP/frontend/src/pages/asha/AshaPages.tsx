import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggleBtn } from '../../contexts/ThemeContext';
import { ashaApi, AshaPatient } from '../../api/client';
import './AshaPages.css';
import './AshaVitals.css';

/* ══════════════════════════════════════════════════
   NATIVE MOBILE SHELL — no global AppLayout at all
   Mimics iOS/Android app shell with safe areas
══════════════════════════════════════════════════ */
function AshaMobileShell({ children, active }: { children: React.ReactNode; active: string }) {
  return (
    <div className="asha-shell">
      <div className="asha-scroll-area">{children}</div>
      <AshaBottomNav active={active} />
    </div>
  );
}

/* ── Top App Bar ── */
function AshaTopBar({
  title, subtitle, backPath, rightEl
}: { title: string; subtitle?: string; backPath?: string; rightEl?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="asha-top-bar">
      <div className="atb-left">
        {backPath ? (
          <button className="asha-back-btn" onClick={() => navigate(backPath)}>
            <i className="bi-chevron-left" />
          </button>
        ) : (
          <button className="asha-top-logo" onClick={() => navigate('/')} title="Back to home">
            <i className="bi-lungs-fill" />
          </button>
        )}
      </div>
      <div className="atb-center">
        <div className="asha-top-title">{title}</div>
        {subtitle && <div className="asha-top-sub">{subtitle}</div>}
      </div>
      <div className="atb-right">{rightEl ?? <div style={{ width:36 }} />}</div>
    </div>
  );
}

/* ── Bottom Navigation ── */
function AshaBottomNav({ active }: { active: string }) {
  const navigate = useNavigate();
  const items = [
    { key:'patients', label:'Patients', icon:'bi-people-fill',       path:'/asha/patients' },
    { key:'checkin',  label:'Check-in', icon:'bi-check-circle-fill',  path:'/asha/checkin'  },
  ];
  return (
    <nav className="asha-bottom-nav">
      {items.map(it => (
        <button key={it.key}
          className={`asha-nav-btn ${active === it.key ? 'active' : ''}`}
          onClick={() => navigate(it.path)}>
          <i className={it.icon} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ═════════════════════════════════════════════════
   PAGE 1 — MY PATIENTS
══════════════════════════════════════════════════ */
export function AshaPatientListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [patients, setPatients] = useState<AshaPatient[]>([]);
  const [filter, setFilter] = useState<'all'|'dots'|'alert'>('all');
  const [summary, setSummary]   = useState<any>({});
  const [loading, setLoading]   = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string|null>(null);

  useEffect(() => {
    setLoading(true);
    ashaApi.getPatients()
      .then(res => {
        setPatients(res.data.patients || []);
        setSummary(res.data.summary || {});
      })
      .catch(() => showToast('Could not load patients', 'var(--red)', 'bi-exclamation-triangle'))
      .finally(() => setLoading(false));
  }, []);

  const alerts      = patients.filter(p => !p.today_taken && p.dots_active).length;
  const dotsCnt     = patients.filter(p => p.dots_active).length;
  const checkedToday= patients.filter(p => p.today_taken).length;

  const filtered = filter === 'dots'  ? patients.filter(p => p.dots_active)
                 : filter === 'alert' ? patients.filter(p => !p.today_taken && p.dots_active)
                 : patients;

  const today = new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });

  const riskColor = (level: string|null) =>
    level === 'high' ? 'var(--red)' : level === 'medium' ? 'var(--amber)' : level === 'low' ? 'var(--green)' : 'var(--text4)';

  const handleSendReminder = async (p: AshaPatient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSendingReminder(p.patient_id);
    try {
      const res = await ashaApi.sendReminder(p.patient_id, {
        language: p.language || 'English',
        dots_day: p.dots_day || 1,
      });
      showToast(
        `AI reminder sent to ${p.full_name}`,
        'var(--teal)',
        'bi-whatsapp'
      );
      console.log('[DOTSAgent] Reminder:', res.data.message);
    } catch {
      showToast('Could not send reminder', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setSendingReminder(null);
    }
  };


  return (
    <AshaMobileShell active="patients">
      <AshaTopBar
        title="LungLens"
        subtitle={user?.full_name || 'ASHA Worker'}
        rightEl={
          <button className="asha-avatar-btn" onClick={() => navigate('/profile')}>
            {(user?.full_name || 'LD').split(' ').map((n: string) => n[0]).join('').slice(0,2)}
          </button>
        }
      />

      {/* Greeting hero */}
      <div className="asha-greeting-strip">
        <div>
          <div className="ags-hi">Good morning 🌿</div>
          <div className="ags-date">{today} · Chittoor village</div>
        </div>
        <div className={`ags-pill ${alerts > 0 ? 'urgent' : 'ok'}`}>
          {loading ? (
            <><i className="bi-arrow-repeat" /> Loading...</>
          ) : alerts > 0 ? (
            <><i className="bi-exclamation-triangle-fill" /> {alerts} alert{alerts>1?'s':''}</>
          ) : (
            <><i className="bi-check-circle-fill" /> All clear</>
          )}
        </div>
      </div>

      {/* Stats row — real from MongoDB */}
      <div className="asha-stats-mini">
        <div className="asm-card">
          <div className="asm-label">Active TB</div>
          <div className="asm-val" style={{ color:'var(--red)' }}>{loading ? '…' : dotsCnt}</div>
        </div>
        <div className="asm-card">
          <div className="asm-label">Checked</div>
          <div className="asm-val" style={{ color: !loading && checkedToday === dotsCnt ? 'var(--green)' : 'var(--amber)' }}>
            {loading ? '…' : `${checkedToday}/${dotsCnt}`}
          </div>
        </div>
        <div className="asm-card">
          <div className="asm-label">Assigned</div>
          <div className="asm-val">{loading ? '…' : patients.length}</div>
        </div>
        <div className="asm-card">
          <div className="asm-label">Due screen</div>
          <div className="asm-val" style={{ color:'var(--amber)' }}>
            {loading ? '…' : patients.filter(p=>p.screening_due).length}
          </div>
        </div>
      </div>

      {!loading && alerts > 0 && (
        <div className="asha-alert-strip" onClick={() => setFilter('alert')}>
          <i className="bi-exclamation-triangle-fill" />
          {alerts} patient{alerts>1?'s':''} missed pill — tap to filter
        </div>
      )}

      {/* Filter chips */}
      <div className="asha-filter-tabs">
        {(['all','dots','alert'] as const).map(f => (
          <button key={f} className={`asha-ftab ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f==='all' ? 'All patients' : f==='dots' ? 'DOTS active' : `Alerts (${alerts})`}
          </button>
        ))}
      </div>

      <div className="asha-section-label">
        <i className="bi-people-fill" style={{ color:'var(--teal)', marginRight:6 }} />
        {loading ? 'Loading patients...' : `${filtered.length} patient${filtered.length!==1?'s':''}`}
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:200, gap:10, color:'var(--text4)' }}>
          <i className="bi-hourglass-split" style={{ fontSize:28 }} />
          <div style={{ fontSize:13 }}>Fetching patient data from PHC...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:200, gap:10, color:'var(--text4)' }}>
          <i className="bi-person-slash" style={{ fontSize:28 }} />
          <div style={{ fontSize:13 }}>No patients found for this filter</div>
        </div>
      ) : (
        <div className="asha-patient-list">
          {filtered.map(p => (
            <div key={p.patient_id} className="asha-patient-card"
              onClick={() => navigate(`/asha/checkin?id=${p.patient_id}`)}>
              <div className="apc-top">
                <div className="apc-avatar">{p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}</div>
                <div className="apc-info">
                  <div className="apc-name">{p.full_name}</div>
                  <div className="apc-meta">{p.age}{p.sex} · {p.village || 'Unknown village'}</div>
                </div>
                <div className="apc-status">
                  {p.screening_due
                    ? <span className="asha-badge asha-badge-warn">Screen due</span>
                    : p.dots_active
                      ? p.today_taken
                        ? <span className="asha-badge asha-badge-ok"><i className="bi-check2" /> Taken</span>
                        : <span className="asha-badge asha-badge-alert"><i className="bi-exclamation" /> Visit now</span>
                      : <span className="asha-badge asha-badge-muted">No DOTS</span>
                  }
                </div>
              </div>

              {p.dots_active && (
                <div className="apc-bottom">
                  <div className="apc-dots-label">Adherence: {p.adherence_pct}%{p.consecutive_missed > 0 ? ` · ⚠️ ${p.consecutive_missed} missed in a row` : ''}</div>
                  <div className="apc-dots-row">
                    {Array.from({length:7}).map((_,i) => (
                      <div key={i} className={`apc-dot ${i >= 7 - p.missed_last_7 ? 'missed' : 'taken'}`} />
                    ))}
                  </div>
                  <div className="apc-meta" style={{ marginTop:4 }}>DOTS day {p.dots_day} · {p.language}</div>
                </div>
              )}

              {/* Real TB risk */}
              {p.tb_risk_level && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:riskColor(p.tb_risk_level) }} />
                    <span style={{ fontSize:11, color:riskColor(p.tb_risk_level), fontWeight:600 }}>
                      {p.tb_risk_level.toUpperCase()} risk · {p.tb_risk_score}%
                    </span>
                  </div>
                  {/* AI DOTSAgent reminder button */}
                  {!p.today_taken && p.dots_active && (
                    <button
                      onClick={(e) => handleSendReminder(p, e)}
                      disabled={sendingReminder === p.patient_id}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:12, border:'1px solid rgba(62,232,160,.3)', background:'var(--teal-a)', color:'var(--teal)', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                      {sendingReminder === p.patient_id
                        ? <><i className="bi-arrow-repeat" /> Sending...</>
                        : <><i className="bi-whatsapp" /> AI Remind</>
                      }
                    </button>
                  )}
                </div>
              )}

              <div className="apc-chevron"><i className="bi-chevron-right" /></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height:100 }} />
    </AshaMobileShell>
  );
}

/* ════════════════════════════════════════════
   PAGE 2 — DAILY DOTS CHECK-IN
════════════════════════════════════════════ */
export function AshaDailyCheckinPage() {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<AshaPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const today      = new Date().toISOString().split('T')[0];
  const storageKey = `vc_dots_status_${today}`;

  const [patientIdx, setPatientIdx] = useState(0);
  const [status, setStatus] = useState<Record<string,'taken'|'missed'|null>>(() => {
    try { const s = sessionStorage.getItem(storageKey); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });
  const [note, setNote]       = useState('');
  const [showNote, setShowNote] = useState(false);
  const [temperature, setTemperature] = useState('');
  const [bp, setBP] = useState({ systolic: '', diastolic: '' });

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await ashaApi.getPatients();
        const dotsPatients = response.data.patients?.filter((p: AshaPatient) => p.dots_active) || [];
        setPatients(dotsPatients);
      } catch (error) {
        showToast('Failed to load patients', 'var(--red)', 'bi-exclamation-triangle');
        console.error('Failed to fetch patients:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [showToast]);

  const dotsPatients = patients;
  const patient      = dotsPatients[patientIdx];
  const weekDays     = ['M','T','W','T','F','S','S'];
  const weekData     = [true,true,true,false,true,true,null] as (boolean|null)[];

  const updateVitals = async () => {
    if (!patient) return;
    try {
      await ashaApi.updateVitals(patient.patient_id, {
        temperature: temperature ? parseFloat(temperature) : undefined,
        blood_pressure: (bp.systolic && bp.diastolic) ? `${bp.systolic}/${bp.diastolic}` : undefined
      });
      showToast('Vitals updated', 'var(--green)', 'bi-check2');
    } catch (error) {
      showToast('Failed to update vitals', 'var(--red)', 'bi-exclamation-triangle');
      console.error('Vitals update failed:', error);
    }
  };

  const confirmAction = async (taken: boolean) => {
    if (!patient) return;

    try {
      const response = await ashaApi.checkinPatient(patient.patient_id, {
        taken,
        note: note || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        blood_pressure: (bp.systolic && bp.diastolic) ? `${bp.systolic}/${bp.diastolic}` : undefined
      });

      setStatus(prev => {
        const next = { ...prev, [patient.patient_id]: taken ? 'taken' : 'missed' } as Record<string,'taken'|'missed'|null>;
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
        return next;
      });

      showToast(
        taken ? `${patient.full_name} — pill confirmed` : `${patient.full_name} — marked as missed`,
        taken ? 'var(--green)' : 'var(--red)',
        taken ? 'bi-check-circle-fill' : 'bi-x-circle-fill'
      );

      if (patientIdx < dotsPatients.length - 1) {
        setTimeout(() => { 
          setPatientIdx(i => i+1); 
          setShowNote(false); 
          setNote(''); 
          setTemperature(''); 
          setBP({ systolic: '', diastolic: '' }); 
        }, 600);
      }
    } catch (error) {
      showToast('Failed to save check-in', 'var(--red)', 'bi-exclamation-triangle');
      console.error('Check-in failed:', error);
    }
  };

  const currentStatus = status[patient?.patient_id];
  const completed     = Object.keys(status).length;

  if (loading) {
    return (
      <AshaMobileShell active="checkin">
        <AshaTopBar title="DOTS Check-in" />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 24, color: 'var(--text4)' }}>
            <i className="bi-hourglass-split" />
          </div>
          <div style={{ fontSize: 14, color: 'var(--text4)' }}>Loading patients...</div>
        </div>
      </AshaMobileShell>
    );
  }

  if (!patient) {
    return (
      <AshaMobileShell active="checkin">
        <AshaTopBar title="DOTS Check-in" />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 24, color: 'var(--text4)' }}>
            <i className="bi-people" />
          </div>
          <div style={{ fontSize: 14, color: 'var(--text4)' }}>No DOTS patients found</div>
        </div>
      </AshaMobileShell>
    );
  }

  return (
    <AshaMobileShell active="checkin">
      <AshaTopBar
        title="DOTS Check-in"
        subtitle={`${completed}/${dotsPatients.length} done today`}
        rightEl={
          <span className="asha-top-tag">
            {Math.round((completed/dotsPatients.length)*100)}%
          </span>
        }
      />

      <div className="asha-progress-bar">
        <div className="asha-progress-fill" style={{ width:`${(completed/dotsPatients.length)*100}%` }} />
      </div>

      <div className="asha-patient-selector">
        {dotsPatients.map((p,i) => (
          <button key={p.patient_id}
            className={`asha-selector-dot ${i===patientIdx?'active':''} ${status[p.patient_id]?(status[p.patient_id]==='taken'?'done-ok':'done-miss'):''}`}
            onClick={() => { setPatientIdx(i); setShowNote(false); setNote(''); }}>
            {status[p.patient_id]==='taken' ? <i className="bi-check2" />
              : status[p.patient_id]==='missed' ? <i className="bi-x" />
              : p.full_name.split(' ')[0][0]}
          </button>
        ))}
      </div>

      <div className="asha-checkin-card">
        <div className="asha-checkin-hero">
          <div className="asha-big-avatar">{patient.full_name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}</div>
          <div className="asha-checkin-name">{patient.full_name}</div>
          <div className="asha-checkin-meta">{patient.age}{patient.sex} · Day {patient.dots_day} · Month {patient.dots_month}/6</div>
          <div className="asha-checkin-meds">Isoniazid 300mg + Rifampicin 600mg</div>
        </div>

        <div className="asha-week-cal">
          <div className="asha-week-title">This week</div>
          <div className="asha-week-row">
            {weekDays.map((d,i) => (
              <div key={i} className="asha-week-cell">
                <div className="asha-week-lbl">{d}</div>
                <div className={`asha-week-dot ${
                  weekData[i]===null
                    ? (currentStatus==='taken'?'wk-ok':currentStatus==='missed'?'wk-miss':'wk-today')
                    : weekData[i] ? 'wk-ok' : 'wk-miss'
                }`}>
                  {weekData[i]===null
                    ? (currentStatus==='taken'?'✓':currentStatus==='missed'?'✗':'?')
                    : weekData[i] ? '✓' : '✗'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vitals Recording Section */}
        <div className="asha-vitals-section">
          <div className="asha-section-label">Record Vitals</div>
          <div className="asha-vitals-row">
            <div className="asha-form-field" style={{ flex: 1 }}>
              <label>Temperature (°F)</label>
              <input 
                value={temperature} 
                onChange={e => setTemperature(e.target.value)}
                placeholder="98.6" 
                type="number" 
                step="0.1"
                min="95" 
                max="105"
              />
            </div>
            <div className="asha-form-field" style={{ flex: 1 }}>
              <label>Blood Pressure</label>
              <div className="asha-bp-inputs">
                <input 
                  value={bp.systolic} 
                  onChange={e => setBP(prev => ({ ...prev, systolic: e.target.value }))}
                  placeholder="120" 
                  type="number" 
                  min="80" 
                  max="200"
                />
                <span className="asha-bp-separator">/</span>
                <input 
                  value={bp.diastolic} 
                  onChange={e => setBP(prev => ({ ...prev, diastolic: e.target.value }))}
                  placeholder="80" 
                  type="number" 
                  min="40" 
                  max="120"
                />
              </div>
            </div>
          </div>
          <button className="asha-big-btn asha-btn-ok" onClick={updateVitals} style={{ marginTop: 8 }}>
            <i className="bi-arrow-clockwise" /> Update Vitals
          </button>
        </div>

        {!currentStatus ? (
          <>
            <div className="asha-question">Did {patient.full_name.split(' ')[0]} take the pill today?</div>
            <button className="asha-big-btn asha-btn-ok" onClick={() => confirmAction(true)}>
              <i className="bi-check-circle-fill" /> Yes — pill taken
            </button>
            <button className="asha-big-btn asha-btn-miss" onClick={() => confirmAction(false)}>
              <i className="bi-x-circle-fill" /> No — not taken
            </button>
            <button className="asha-ghost-btn" onClick={() => setShowNote(n => !n)}>
              <i className="bi-chat-text" /> {showNote ? 'Hide note' : 'Add note / side effect'}
            </button>
            {showNote && (
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Side effects, observations, weight…"
                style={{ marginTop:8, fontSize:13, background:'var(--bg3)', border:'1px solid var(--border)',
                  borderRadius:8, padding:'10px 12px', color:'var(--text)', resize:'none',
                  height:80, width:'100%', fontFamily:'var(--body)' }} />
            )}
          </>
        ) : (
          <div className={`asha-confirmed-strip ${currentStatus==='taken'?'ok':'miss'}`}>
            <i className={currentStatus==='taken'?'bi-check-circle-fill':'bi-x-circle-fill'} />
            {currentStatus==='taken' ? 'Pill confirmed — record saved' : 'Missed — WhatsApp alert sent'}
          </div>
        )}
      </div>
      <div style={{ height:100 }} />
    </AshaMobileShell>
  );
}

/* ════════════════════════════════════════════
   PAGE 3 — REGISTER PATIENT
════════════════════════════════════════════ */
export function AshaRegisterPage() {
  const { showToast } = useToast();
  const navigate      = useNavigate();
  const [form, setForm]   = useState({ name:'', age:'', sex:'', village:'', phone:'', complaint:'', language:'', temperature:'', weight:'', bp: { systolic: '', diastolic: '' } });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const ticket = `PRE-2026-${Math.floor(Math.random()*9000+1000)}`;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.age || !form.sex || !form.village || !form.complaint) {
      showToast('Please fill required fields', 'var(--red)', 'bi-exclamation-circle'); return;
    }
    setLoading(true);
    try {
      const response = await ashaApi.registerPatient({
        full_name: form.name,
        age: parseInt(form.age),
        sex: form.sex,
        village: form.village,
        phone: form.phone,
        chief_complaint: form.complaint,
        preferred_language: form.language,
        temperature: form.temperature ? parseFloat(form.temperature) : undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        blood_pressure: (form.bp.systolic && form.bp.diastolic) ? `${form.bp.systolic}/${form.bp.diastolic}` : undefined
      });
      
      setSuccess(true);
      showToast(`Patient registered — ${response.data.message}`, 'var(--green)', 'bi-check-circle-fill');
    } catch (error) {
      showToast('Failed to register patient', 'var(--red)', 'bi-exclamation-triangle');
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <AshaMobileShell active="register">
      <AshaTopBar title="Register Patient" />
      <div className="asha-success-screen">
        <div className="asha-success-icon"><i className="bi-check-circle-fill" /></div>
        <div className="asha-success-title">Patient registered!</div>
        <div className="asha-success-sub">PHC Chittoor has been notified.<br />Ticket: <strong>{ticket}</strong></div>
        <button className="asha-big-btn asha-btn-ok" style={{ marginTop:24 }}
          onClick={() => { setSuccess(false); setForm({ name:'', age:'', sex:'', village:'', phone:'', complaint:'', language:'', temperature:'', weight:'', bp: { systolic: '', diastolic: '' } }); }}>
          Register another patient
        </button>
        <button className="asha-ghost-btn" onClick={() => navigate('/asha/patients')}>Back to patients</button>
      </div>
      <div style={{ height:100 }} />
    </AshaMobileShell>
  );

  return (
    <AshaMobileShell active="register">
      <AshaTopBar title="Register Patient" subtitle="Pre-PHC registration from village" />
      <form className="asha-form" onSubmit={submit}>
        <div className="asha-form-section-label">Patient details</div>
        <div className="asha-form-field">
          <label>Full name <span className="req">*</span></label>
          <input value={form.name} onChange={set('name')} placeholder="Patient full name" />
        </div>
        <div className="asha-form-row">
          <div className="asha-form-field">
            <label>Age <span className="req">*</span></label>
            <input value={form.age} onChange={set('age')} placeholder="Years" type="number" min="0" max="120" />
          </div>
          <div className="asha-form-field">
            <label>Sex <span className="req">*</span></label>
            <select value={form.sex} onChange={set('sex')}>
              <option value="">Select</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
        </div>
        <div className="asha-form-field">
          <label>Village / address <span className="req">*</span></label>
          <input value={form.village} onChange={set('village')} placeholder="Village name" />
        </div>
        <div className="asha-form-field">
          <label>Phone number</label>
          <input value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" type="tel" />
        </div>
        <div className="asha-form-section-label" style={{ marginTop:18 }}>Medical information</div>
        <div className="asha-form-field">
          <label>Chief complaint <span className="req">*</span></label>
          <select value={form.complaint} onChange={set('complaint')}>
            <option value="">Select main complaint</option>
            <option>Cough 2+ weeks</option>
            <option>Cough with fever</option>
            <option>Night fever + weight loss</option>
            <option>TB contact in household</option>
            <option>Blood in cough</option>
            <option>Follow-up visit</option>
            <option>Other</option>
          </select>
        </div>
        <div className="asha-form-field">
          <label>Preferred language</label>
          <select value={form.language} onChange={set('language')}>
            <option value="">Select language</option>
            <option>Telugu</option><option>English</option><option>Hindi</option>
            <option>Tamil</option><option>Kannada</option><option>Marathi</option>
            <option>Bengali</option><option>Gujarati</option><option>Punjabi</option>
            <option>Odia</option><option>Malayalam</option>
          </select>
        </div>
        <div className="asha-form-section-label" style={{ marginTop:18 }}>Vital Signs</div>
        <div className="asha-form-row">
          <div className="asha-form-field">
            <label>Temperature (°F)</label>
            <input value={form.temperature} onChange={set('temperature')} placeholder="98.6" type="number" step="0.1" min="95" max="105" />
          </div>
          <div className="asha-form-field">
            <label>Weight (kg)</label>
            <input value={form.weight} onChange={set('weight')} placeholder="58" type="number" step="0.1" min="20" max="200" />
          </div>
        </div>
        <div className="asha-form-field">
          <label>Blood Pressure</label>
          <div className="asha-bp-inputs">
            <input 
              value={form.bp.systolic} 
              onChange={e => setForm(f => ({ ...f, bp: { ...f.bp, systolic: e.target.value } }))} 
              placeholder="120" 
              type="number" 
              min="80" 
              max="200"
            />
            <span className="asha-bp-separator">/</span>
            <input 
              value={form.bp.diastolic} 
              onChange={e => setForm(f => ({ ...f, bp: { ...f.bp, diastolic: e.target.value } }))} 
              placeholder="80" 
              type="number" 
              min="40" 
              max="120"
            />
          </div>
        </div>
        <button type="submit" className="asha-big-btn asha-btn-ok" disabled={loading} style={{ marginTop:8 }}>
          {loading
            ? <><i className="bi-arrow-repeat" style={{ animation:'vcSpin .7s linear infinite' }} /> Registering...</>
            : <><i className="bi-send-fill" /> Register &amp; send to PHC</>}
        </button>
      </form>
      <div style={{ height:100 }} />
    </AshaMobileShell>
  );
}

/* ════════════════════════════════════════════
   PAGE 4 — VISIT LOG
════════════════════════════════════════════ */
export function AshaVisitLogPage() {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<string|null>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        // For now, we'll use a mock patient ID since we don't have patient selection
        // In a real implementation, this would come from navigation state or selection
        const response = await ashaApi.getPatientVisits('p001');
        setVisits(response.data.visits || []);
      } catch (error) {
        showToast('Failed to load visits', 'var(--red)', 'bi-exclamation-triangle');
        console.error('Failed to fetch visits:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVisits();
  }, [showToast]);

  const sColor = (s:string) => s==='taken'?'var(--green)':s==='missed'?'var(--red)':'var(--amber)';
  const sIcon  = (s:string) => s==='taken'?'bi-check-circle-fill':s==='missed'?'bi-x-circle-fill':'bi-clock-fill';
  const sLabel = (s:string) => s==='taken'?'Taken':s==='missed'?'Missed':'Pending';

  if (loading) {
    return (
      <AshaMobileShell active="visits">
        <AshaTopBar title="Visit Log" />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 24, color: 'var(--text4)' }}>
            <i className="bi-hourglass-split" />
          </div>
          <div style={{ fontSize: 14, color: 'var(--text4)' }}>Loading visits...</div>
        </div>
      </AshaMobileShell>
    );
  }

  return (
    <AshaMobileShell active="visits">
      <AshaTopBar
        title="Visit Log"
        subtitle={`${visits.length} visits recorded`}
        rightEl={
          <button className="asha-icon-btn" onClick={() => showToast('Log exported','var(--teal)','bi-download')}>
            <i className="bi-download" />
          </button>
        }
      />

      <div className="asha-log-summary">
        <div className="als-pill green"><i className="bi-check-circle-fill" /> {visits.filter(v=>v.status==='taken').length} taken</div>
        <div className="als-pill red"><i className="bi-x-circle-fill" /> {visits.filter(v=>v.status==='missed').length} missed</div>
        <div className="als-pill amber"><i className="bi-clock-fill" /> {visits.filter(v=>v.status==='pending').length} pending</div>
      </div>

      <div className="asha-log-list">
        {visits.map(v => (
          <div key={v.id} className={`asha-log-item ${selected===v.id?'expanded':''}`}
            onClick={() => setSelected(selected===v.id ? null : v.id)}>
            <div className="ali-row">
              <div className="ali-icon" style={{ color:sColor(v.status) }}><i className={sIcon(v.status)} /></div>
              <div className="ali-body">
                <div className="ali-name">{v.patient}</div>
                <div className="ali-meta">{v.date} · {v.type}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span className="asha-badge" style={{ background:`${sColor(v.status)}18`, color:sColor(v.status), border:`1px solid ${sColor(v.status)}30`, fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700 }}>
                  {sLabel(v.status)}
                </span>
                <i className={`bi-chevron-${selected===v.id?'up':'down'}`} style={{ color:'var(--text4)', fontSize:11 }} />
              </div>
            </div>
            {selected===v.id && (
              <div className="ali-note">
                <i className="bi-chat-text" style={{ marginRight:6, color:'var(--text4)' }} />{v.note}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ height:100 }} />
    </AshaMobileShell>
  );
}

/* ════════════════════════════════════════════
   PAGE 5 — ASHA PROFILE
════════════════════════════════════════════ */
export function AshaProfilePage() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const { showToast }     = useToast();
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || 'Lakshmi Devi');
  const [phone, setPhone]       = useState('+91 98765 43210');

  return (
    <AshaMobileShell active="profile">
      <AshaTopBar title="My Profile" />
      <div className="asha-profile-hero">
        <div className="asha-big-avatar" style={{ width:72, height:72, fontSize:24, margin:'0 auto 12px' }}>
          {(user?.full_name||'LD').split(' ').map((n: string) => n[0]).join('').slice(0,2)}
        </div>
        <div className="asha-checkin-name" style={{ fontSize:18 }}>{user?.full_name||'Lakshmi Devi'}</div>
        <div className="asha-checkin-meta" style={{ marginBottom:8 }}>ASHA Worker · Chittoor Block</div>
        <span className="asha-badge asha-badge-ok">Active · 4 patients assigned</span>
      </div>

      <div className="asha-profile-section">
        <div className="aps-title">Account details</div>
        {editMode ? (
          <>
            <div className="asha-form-field" style={{ marginBottom:10 }}>
              <label>Full name</label>
              <input value={fullName} onChange={e=>setFullName(e.target.value)} />
            </div>
            <div className="asha-form-field" style={{ marginBottom:10 }}>
              <label>Phone</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="asha-big-btn asha-btn-ok" style={{ flex:1, padding:'10px' }}
                onClick={() => { setEditMode(false); showToast('Profile saved','var(--green)','bi-check2'); }}>Save</button>
              <button className="asha-ghost-btn" style={{ flex:1, padding:'10px', marginTop:0 }}
                onClick={() => setEditMode(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            {[['Email', user?.email||'lakshmi@nrhm.gov.in'],['Phone',phone],['Block','Chittoor Block, AP'],['ASHA ID','ASHA-CHT-2024-0847']].map(([k,v]) => (
              <div key={k} className="aps-row"><span className="aps-key">{k}</span><span className="aps-val">{v}</span></div>
            ))}
            <button className="asha-ghost-btn" style={{ marginTop:10 }} onClick={() => setEditMode(true)}>
              <i className="bi-pencil" /> Edit profile
            </button>
          </>
        )}
      </div>

      <div className="asha-profile-section">
        <div className="aps-title">My stats (this month)</div>
        <div className="asha-stats-mini" style={{ marginBottom:0 }}>
          <div className="asm-card"><div className="asm-label">Visits done</div><div className="asm-val">38</div></div>
          <div className="asm-card"><div className="asm-label">DOTS logged</div><div className="asm-val">52</div></div>
          <div className="asm-card"><div className="asm-label">Registered</div><div className="asm-val">3</div></div>
          <div className="asm-card"><div className="asm-label">Adherence</div><div className="asm-val" style={{ color:'var(--green)' }}>82%</div></div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, margin:'16px 14px' }}>
        <button className="asha-ghost-btn" style={{ justifyContent:'center', color:'var(--red)' }}
          onClick={() => { logout(); navigate('/'); }}>
          <i className="bi-box-arrow-right" /> Sign out
        </button>
      </div>
      <div style={{ height:100 }} />
    </AshaMobileShell>
  );
}