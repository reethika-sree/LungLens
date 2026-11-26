import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import RoleLayout from '../../layouts/RoleLayout';
import { patientApi, DotsStats } from '../../api/client';
import '../../styles/Dashboard.css';

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [records, setRecords] = useState<any[]>([]);
  const [dotsStats, setDotsStats] = useState<DotsStats | null>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [l2Status, setL2Status] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [recRes, dotsRes, queueRes, l2Res] = await Promise.allSettled([
          patientApi.getMyRecords(),
          patientApi.getMyCheckins(30),
          patientApi.getQueueStatus(),
          patientApi.getL2Status(),
        ]);

        if (mounted) {
          if (recRes.status === 'fulfilled') setRecords(recRes.value.data || []);
          if (dotsRes.status === 'fulfilled') setDotsStats(dotsRes.value.data.stats || null);
          if (queueRes.status === 'fulfilled') setQueueStatus(queueRes.value.data || null);
          if (l2Res.status === 'fulfilled') setL2Status(l2Res.value.data || null);
        }
      } catch (err) {
        console.error('Failed to load patient dashboard data', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, []);

  const latestRecord = records[0];
  const hasAssessment = latestRecord && latestRecord.status === 'prediction_complete';
  const riskLevel = latestRecord?.tb_risk_level || 'Pending';
  const riskScore = latestRecord?.tb_risk_score !== undefined ? `${latestRecord.tb_risk_score}%` : 'N/A';
  const priority = latestRecord?.priority || queueStatus?.priority || 'P3';

  return (
    <RoleLayout activeNav="dashboard" pageTitle="Patient Dashboard">
      <div className="dash-container">
        {/* ── Welcome Hero Banner ── */}
        <div className="dash-hero">
          <div>
            <div className="dash-hero-title">
              Welcome back, <span>{user?.full_name || 'Patient'}</span>
            </div>
            <div className="dash-hero-sub">
              Your voice-powered Tuberculosis triage & health monitoring hub.
              Start a new symptom intake in <strong>{language}</strong>, review your AI clinical predictions, or manage your daily DOTS medication.
            </div>
          </div>
          <div className="dash-hero-cta">
            <button
              className="vc-btn vc-btn-teal"
              onClick={() => navigate('/patient/language')}
              style={{ padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="bi-mic-fill" /> Start Voice Screening
            </button>
            <button
              className="vc-btn vc-btn-ghost"
              onClick={() => navigate('/patient/history')}
              style={{ padding: '10px 16px' }}
            >
              <i className="bi-clock-history" /> Past Records
            </button>
          </div>
        </div>

        {/* ── 4 KPI Status Cards ── */}
        <div className="dash-kpi-grid">
          {/* Card 1: Screening Status */}
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(0,232,181,0.12)', color: 'var(--teal)' }}>
              <i className="bi-shield-check" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val" style={{ textTransform: 'capitalize' }}>
                {hasAssessment ? riskLevel : records.length > 0 ? 'In Progress' : 'Not Started'}
              </div>
              <div className="dash-kpi-label">TB Risk Assessment</div>
              <div className="dash-kpi-badge" style={{ color: hasAssessment ? 'var(--teal)' : 'var(--text4)' }}>
                {hasAssessment ? `Score: ${riskScore} (${priority})` : 'Self-assessment needed'}
              </div>
            </div>
          </div>

          {/* Card 2: PHC Queue Ticket */}
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(110,184,255,0.12)', color: 'var(--blue)' }}>
              <i className="bi-ticket-perforated-fill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">
                {queueStatus?.in_queue ? `#${queueStatus.position}` : '~8 min'}
              </div>
              <div className="dash-kpi-label">Clinic Queue Ticket</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--blue)' }}>
                {priority} Priority · PHC Triage
              </div>
            </div>
          </div>

          {/* Card 3: DOTS Medication Adherence */}
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(247,187,74,0.12)', color: 'var(--amber)' }}>
              <i className="bi-capsule-pill" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">
                {dotsStats ? `${dotsStats.pct}%` : '89%'}
              </div>
              <div className="dash-kpi-label">DOTS Pill Adherence</div>
              <div className="dash-kpi-badge" style={{ color: 'var(--amber)' }}>
                {dotsStats?.consecutive_missed ? `${dotsStats.consecutive_missed} missed recently` : 'On track this month'}
              </div>
            </div>
          </div>

          {/* Card 4: Diagnostic Referral */}
          <div className="dash-kpi-card">
            <div className="dash-kpi-icon" style={{ background: 'rgba(184,164,255,0.12)', color: 'var(--purple)' }}>
              <i className="bi-hospital" />
            </div>
            <div className="dash-kpi-info">
              <div className="dash-kpi-val">
                {l2Status?.l2_referred ? 'Referred' : 'Routine'}
              </div>
              <div className="dash-kpi-label">Specialist / L2 Lab</div>
              <div className="dash-kpi-badge" style={{ color: l2Status?.l2_referred ? 'var(--purple)' : 'var(--text4)' }}>
                {l2Status?.l2_referred ? 'GeneXpert / X-Ray Referred' : 'No urgent escalation'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions Grid ── */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>
            Quick Clinical Actions
          </div>
          <div className="dash-actions-grid">
            {/* Action 1 */}
            <div className="dash-action-card" onClick={() => navigate('/patient/language')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(0,232,181,0.12)', color: 'var(--teal)' }}>
                  <i className="bi-mic-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Start Voice Screening</div>
                  <div className="dash-action-desc">
                    Speak your symptoms in Telugu, Hindi, or English. Whisper STT converts speech to text with instant clinical extraction.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Select Language & Speak</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            {/* Action 2 */}
            <div className="dash-action-card" onClick={() => navigate('/patient/dialogue')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(110,184,255,0.12)', color: 'var(--blue)' }}>
                  <i className="bi-chat-dots-fill" />
                </div>
                <div>
                  <div className="dash-action-title">Dynamic AI Dialogue</div>
                  <div className="dash-action-desc">
                    Contextual follow-up interview tailored to what you said. Answer with Avunu (అవును) / Ledhu (లేదు) or by speaking.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Open Dynamic Dialogue</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            {/* Action 3 */}
            <div className="dash-action-card" onClick={() => navigate('/patient/prediction')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>
                  <i className="bi-cpu-fill" />
                </div>
                <div>
                  <div className="dash-action-title">View TB Risk Assessment</div>
                  <div className="dash-action-desc">
                    Inspect your XGBoost prediction score, contributing symptom factors, priority ranking, and official medical guidance.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>View Full Assessment</span>
                <i className="bi-arrow-right" />
              </div>
            </div>

            {/* Action 4 */}
            <div className="dash-action-card" onClick={() => navigate('/patient/history')}>
              <div className="dash-action-top">
                <div className="dash-action-icon" style={{ background: 'rgba(247,187,74,0.12)', color: 'var(--amber)' }}>
                  <i className="bi-folder-check" />
                </div>
                <div>
                  <div className="dash-action-title">Consultation Records</div>
                  <div className="dash-action-desc">
                    Access historical screening transcripts, doctor notes, prescription slips, and downloadable health receipts.
                  </div>
                </div>
              </div>
              <div className="dash-action-footer">
                <span>Browse Records</span>
                <i className="bi-arrow-right" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Screening Table ── */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title">
              <i className="bi-clock-history" style={{ color: 'var(--teal)' }} />
              <span>Recent Consultations & Screenings</span>
            </div>
            <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => navigate('/patient/history')}>
              View All
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text4)' }}>
              Loading health records…
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)' }}>
              <i className="bi-clipboard2-check" style={{ fontSize: 32, color: 'var(--text4)', display: 'block', marginBottom: 8 }} />
              <div>No screening consultations found yet.</div>
              <button
                className="vc-btn vc-btn-teal vc-btn-sm"
                onClick={() => navigate('/patient/language')}
                style={{ marginTop: 12 }}
              >
                <i className="bi-mic-fill" /> Start Your First Screening
              </button>
            </div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Language</th>
                  <th>Risk Tier</th>
                  <th>Score</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 5).map(r => (
                  <tr key={r.record_id}>
                    <td>{new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{r.language || 'English'}</td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: r.tb_risk_level === 'high' ? 'rgba(239,68,68,0.12)' : r.tb_risk_level === 'medium' ? 'rgba(247,187,74,0.12)' : 'rgba(0,232,181,0.12)',
                          color: r.tb_risk_level === 'high' ? 'var(--red)' : r.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--teal)'
                        }}
                      >
                        {r.tb_risk_level || 'pending'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{r.tb_risk_score !== null && r.tb_risk_score !== undefined ? `${r.tb_risk_score}%` : '—'}</td>
                    <td><span style={{ fontWeight: 600 }}>{r.priority || 'P3'}</span></td>
                    <td>
                      <span style={{ fontSize: 12, color: r.status === 'prediction_complete' ? 'var(--teal)' : 'var(--amber)' }}>
                        {r.status === 'prediction_complete' ? '✓ Assessed' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="vc-btn vc-btn-ghost vc-btn-sm"
                        onClick={() => navigate('/patient/prediction', { state: { recordId: r.record_id } })}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Official Medical Disclaimer ── */}
        <div className="dash-disclaimer">
          <i className="bi-exclamation-triangle-fill" />
          <div>
            <strong>Important Clinical Disclaimer:</strong> LungLens is an AI-powered symptom screening and triage assistance tool. It provides probabilistic preliminary evaluations and does not constitute a confirmatory medical diagnosis. If you experience hemoptysis (blood in sputum), severe breathlessness, or persistent cough exceeding two weeks, immediately visit your nearest Primary Health Centre (PHC) or Government Chest Hospital for confirmatory sputum microscopy, CBNAAT/GeneXpert, and chest radiography.
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}
