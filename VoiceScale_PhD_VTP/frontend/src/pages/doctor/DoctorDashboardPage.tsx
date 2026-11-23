import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RoleLayout from '../../layouts/RoleLayout';
import { doctorApi } from '../../api/client';
import '../../styles/Dashboard.css';

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadDoctorData = async () => {
      try {
        const [statsRes, queueRes] = await Promise.allSettled([
          doctorApi.getStats(),
          doctorApi.getQueue()
        ]);

        if (mounted) {
          if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || null);
          if (queueRes.status === 'fulfilled') setQueue(queueRes.value.data.queue || []);
        }
      } catch (err) {
        console.error('Failed to load doctor dashboard data', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDoctorData();
    return () => { mounted = false; };
  }, []);

  const totalPatients = stats?.total ?? queue.length;
  const highRisk = stats?.high_risk ?? queue.filter(p => p.tb_risk_level === 'high').length;
  const mediumRisk = stats?.medium_risk ?? queue.filter(p => p.tb_risk_level === 'medium').length;
  const p1Urgent = queue.filter(p => p.priority === 'P1').length;

  return (
    <RoleLayout activeNav="dashboard" pageTitle="PHC Doctor Dashboard">
      <div className="dash-container">
        {/* ── Doctor Hero Banner ── */}
        <div className="dash-hero" style={{ borderColor: 'rgba(184,164,255,0.3)', background: 'linear-gradient(135deg, rgba(184,164,255,0.08), rgba(0,232,181,0.05))' }}>
          <div>
            <div className="dash-hero-title">
              Doctor Command Center — <span>{user?.full_name || 'Dr. Medical Officer'}</span>
            </div>
            <div className="dash-hero-sub">
              Live AI-ranked patient triage queue powered by XGBoost & SHAP. Prioritizing presumptive pulmonary TB consultations for early sputum smear microscopy & CBNAAT diagnosis.
            </div>
          </div>
          <div className="dash-hero-cta">
            <button
              className="vc-btn vc-btn-teal"
              onClick={() => navigate('/doctor/queue')}
              style={{ padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="bi-person-lines-fill" /> Open Live Queue ({queue.length})
            </button>
            <button
              className="vc-btn vc-btn-ghost"
              onClick={() => navigate('/doctor/tele')}
              style={{ padding: '10px 16px' }}
            >
              <i className="bi-camera-video-fill" /> Teleconsult
            </button>
          </div>
        </div>

        {/* ── 4 KPI Stats Cards ── */}
        <div className="dash-kpi-grid">
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(184,164,255,0.12)', color: 'var(--purple)' }}>
              <i className="bi-people-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">{totalPatients}</div>
              <div className="dash-kpi-label">Total Screenings</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--purple)' }}>
                Active PHC Consultations
              </div>
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>
              <i className="bi-exclamation-octagon-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val" style={{ color: 'var(--red)' }}>{p1Urgent}</div>
              <div className="dash-kpi-label">P1 Critical Cases</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--red)' }}>
                Immediate Sputum / X-Ray
              </div>
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(247,187,74,0.12)', color: 'var(--amber)' }}>
              <i className="bi-lightning-charge-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val" style={{ color: 'var(--amber)' }}>{highRisk}</div>
              <div className="dash-kpi-label">P2 High Risk Cases</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--amber)' }}>
                Cough &gt; 2w / Night Fever
              </div>
            </div>
          </div>

          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(0,232,181,0.12)', color: 'var(--teal)' }}>
              <i className="bi-check-all" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">{mediumRisk}</div>
              <div className="dash-kpi-label">Moderate / Routine</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--teal)' }}>
                Outpatient Follow-up
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Clinical Tools Grid ── */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>
            Clinical Workflow Modules
          </div>
          <div className="dash-actions-grid">
            <div className="dash-action-card" onClick={() => navigate('/doctor/queue')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(184,164,255,0.12)', color: 'var(--purple)' }}>
                  <i className="bi-sort-numeric-down" />
                </div>
                <div>
                  <div className="dash-action-title">AI Patient Triage Queue</div>
                  <div className="dash-action-desc">
                    Live dynamic ranking of all outpatient screenings. Filter by priority P1–P4, view symptom duration, and launch case reviews.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>View Full Queue</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            <div className="dash-action-card" onClick={() => navigate('/doctor/shap')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(0,232,181,0.12)', color: 'var(--teal)' }}>
                  <i className="bi-diagram-3-fill" />
                </div>
                <div>
                  <div className="dash-action-title">SHAP Risk Explainability</div>
                  <div className="dash-action-desc">
                    Examine tree-based SHAP waterfall contributions for each prediction. Verify whether hemoptysis, fever, or weight loss drove the score.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Open SHAP Analysis</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            <div className="dash-action-card" onClick={() => navigate('/doctor/action')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(110,184,255,0.12)', color: 'var(--blue)' }}>
                  <i className="bi-clipboard2-pulse-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Clinical Actions & Orders</div>
                  <div className="dash-action-desc">
                    Order GeneXpert molecular testing, initiate standard 4-drug DOTS therapy, write clinical notes, or refer to district hospital.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Manage Prescriptions</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            <div className="dash-action-card" onClick={() => navigate('/doctor/tele')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(247,187,74,0.12)', color: 'var(--amber)' }}>
                  <i className="bi-camera-video-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Integrated Teleconsultation</div>
                  <div className="dash-action-desc">
                    Connect directly with rural patients and sub-centre ASHA workers over high-definition WebRTC video without third-party tools.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Launch Video Session</span>
                <i className="bi-arrow-right" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Live Queue Table Preview ── */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title">
              <i className="bi-person-lines-fill" style={{ color: 'var(--purple)' }} />
              <span>Priority Outpatient Triage Queue</span>
            </div>
            <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => navigate('/doctor/queue')}>
              Full Triage List ({queue.length})
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text4)' }}>
              Loading clinical queue…
            </div>
          ) : queue.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)' }}>
              <i className="bi-check-circle" style={{ fontSize: 32, color: 'var(--teal)', display: 'block', marginBottom: 8 }} />
              <div>All screened cases reviewed. Triage queue is currently clear.</div>
            </div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Patient Name</th>
                  <th>Language</th>
                  <th>Risk Level</th>
                  <th>XGBoost Score</th>
                  <th>Intake Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.slice(0, 6).map(p => (
                  <tr key={p.record_id}>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: p.priority === 'P1' ? 'rgba(239,68,68,0.15)' : p.priority === 'P2' ? 'rgba(247,187,74,0.15)' : 'rgba(0,232,181,0.15)',
                          color: p.priority === 'P1' ? 'var(--red)' : p.priority === 'P2' ? 'var(--amber)' : 'var(--teal)'
                        }}
                      >
                        {p.priority}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.patient_name}</td>
                    <td>{p.language || 'English'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.tb_risk_level}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{p.tb_risk_score}%</td>
                    <td>{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <button
                        className="vc-btn vc-btn-teal vc-btn-sm"
                        onClick={() => navigate('/doctor/patient', { state: { recordId: p.record_id } })}
                      >
                        Examine Case
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
