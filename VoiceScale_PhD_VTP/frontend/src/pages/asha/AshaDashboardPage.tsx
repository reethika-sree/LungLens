import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RoleLayout from '../../layouts/RoleLayout';
import { ashaApi, AshaPatient } from '../../api/client';
import '../../styles/Dashboard.css';

export default function AshaDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<AshaPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAshaData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await ashaApi.getPatients();
      const raw = res.data as any;
      const list = Array.isArray(raw) ? raw : (raw?.patients || []);
      setPatients(list);
    } catch (err: any) {
      console.error('Failed to load ASHA dashboard data', err);
      setErrorMsg(err?.response?.data?.detail || 'Could not load ASHA patient list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAshaData();
  }, []);

  const totalPatients = patients.length;
  const takenToday = patients.filter(p => p.today_taken).length;
  const adherenceRate = totalPatients > 0 ? Math.round((takenToday / totalPatients) * 100) : 0;
  const missedDoses = patients.filter(p => p.consecutive_missed > 0).length;
  const highRisk = patients.filter(p => p.tb_risk_level === 'high').length;

  return (
    <RoleLayout activeNav="dashboard" pageTitle="ASHA Community Portal">
      <div className="dash-container">
        {/* ── ASHA Hero Banner ── */}
        <div className="dash-hero" style={{ borderColor: 'rgba(110,184,255,0.3)', background: 'linear-gradient(135deg, rgba(110,184,255,0.08), rgba(0,232,181,0.05))' }}>
          <div>
            <div className="dash-hero-title">
              Community Field Hub — <span>{user?.full_name || 'ASHA Facilitator'}</span>
            </div>
            <div className="dash-hero-sub">
              Village-level TB screening, daily DOTS (Directly Observed Therapy) medication adherence tracking, and high-risk case follow-up. Designed for mobile fieldwork.
            </div>
          </div>
          <div className="dash-hero-cta">
            <button
              className="vc-btn vc-btn-teal"
              onClick={() => navigate('/asha/checkin')}
              style={{ padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="bi-check2-circle" /> Today's DOTS Check-in
            </button>
            <button
              className="vc-btn vc-btn-ghost"
              onClick={() => navigate('/asha/register')}
              style={{ padding: '10px 16px' }}
            >
              <i className="bi-person-plus-fill" /> Register Patient
            </button>
          </div>
        </div>

        {/* ── 4 KPI Stats Cards ── */}
        <div className="dash-kpi-grid">
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(110,184,255,0.12)', color: 'var(--blue)' }}>
              <i className="bi-people-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">{totalPatients}</div>
              <div className="dash-kpi-label">Assigned Village Patients</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--blue)' }}>
                Active DOTS Follow-up
              </div>
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(0,232,181,0.12)', color: 'var(--teal)' }}>
              <i className="bi-capsule-pill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">{adherenceRate}%</div>
              <div className="dash-kpi-label">Today's DOTS Adherence</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--teal)' }}>
                {takenToday} of {totalPatients} pills confirmed
              </div>
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>
              <i className="bi-bell-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val" style={{ color: 'var(--red)' }}>{missedDoses}</div>
              <div className="dash-kpi-label">Missed Dose Alerts</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--red)' }}>
                Requires Home Visit
              </div>
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(247,187,74,0.12)', color: 'var(--amber)' }}>
              <i className="bi-exclamation-circle-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val" style={{ color: 'var(--amber)' }}>{highRisk}</div>
              <div className="dash-kpi-label">High-Risk Presumptive</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--amber)' }}>
                Referred to Doctor
              </div>
            </div>
          </div>
        </div>

        {/* ── Field Quick Actions Grid ── */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>
            Community Field Modules
          </div>
          <div className="dash-actions-grid">
            <div className="dash-action-card" onClick={() => navigate('/asha/checkin')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(0,232,181,0.12)', color: 'var(--teal)' }}>
                  <i className="bi-check-circle-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Daily DOTS Pill Verification</div>
                  <div className="dash-action-desc">
                    Confirm and log whether assigned TB patients took their scheduled daily dose. Send instant automated WhatsApp reminders.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Start Daily Check-in</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            <div className="dash-action-card" onClick={() => navigate('/asha/register')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(110,184,255,0.12)', color: 'var(--blue)' }}>
                  <i className="bi-person-plus-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Register Village Patient</div>
                  <div className="dash-action-desc">
                    Enroll a new presumptive TB patient during household survey visits. Captures age, sex, village, language, and phone.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>New Registration</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            <div className="dash-action-card" onClick={() => navigate('/asha/patients')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(184,164,255,0.12)', color: 'var(--purple)' }}>
                  <i className="bi-people-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Village Patient Directory</div>
                  <div className="dash-action-desc">
                    Comprehensive roster of all community cases under your care. View treatment month, adherence records, and vitals.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Browse Patients</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            <div className="dash-action-card" onClick={() => navigate('/asha/visits')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(247,187,74,0.12)', color: 'var(--amber)' }}>
                  <i className="bi-journal-medical" />
                </div>
                <div>
                  <div className="dash-action-title">Home Visit Logs</div>
                  <div className="dash-action-desc">
                    Document physical home visits, record observed medication side-effects, and record patient vitals (BP, temperature, weight).
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Record Visit</span>
                <i className="bi-arrow-right" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Urgent Follow-Up Alert Table ── */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title">
              <i className="bi-bell-fill" style={{ color: 'var(--red)' }} />
              <span>Urgent Missed Dose &amp; High-Risk Escalations</span>
            </div>
            <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => navigate('/asha/patients')}>
              View All Patients ({patients.length})
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text4)' }}>
              Loading patient data…
            </div>
          ) : errorMsg ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--red)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div><i className="bi-exclamation-triangle-fill" /> {errorMsg}</div>
              <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={loadAshaData}>
                <i className="bi-arrow-clockwise" /> Retry
              </button>
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text4)' }}>
              No assigned village patients yet. Click <strong>Register Patient</strong> to enroll your first case.
            </div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Village</th>
                  <th>Treatment Day</th>
                  <th>Adherence Rate</th>
                  <th>Missed Doses</th>
                  <th>Today's Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.slice(0, 6).map(p => (
                  <tr key={p.patient_id}>
                    <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                    <td>{p.village}</td>
                    <td>Day {p.dots_day} (Mo {p.dots_month})</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{p.adherence_pct}%</td>
                    <td>
                      <span style={{ color: p.consecutive_missed > 0 ? 'var(--red)' : 'var(--text4)', fontWeight: p.consecutive_missed > 0 ? 700 : 400 }}>
                        {p.consecutive_missed > 0 ? `${p.consecutive_missed} consecutive` : 'None'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: p.today_taken ? 'rgba(0,232,181,0.15)' : 'rgba(239,68,68,0.15)',
                          color: p.today_taken ? 'var(--teal)' : 'var(--red)'
                        }}
                      >
                        {p.today_taken ? '✓ Taken' : '✗ Pending'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="vc-btn vc-btn-teal vc-btn-sm"
                        onClick={() => navigate(`/asha/checkin?id=${p.patient_id}`)}
                      >
                        Log Dose
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}
