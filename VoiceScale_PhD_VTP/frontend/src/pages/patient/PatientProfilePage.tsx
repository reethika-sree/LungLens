import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../AppLayout';
import { patientApi, authApi, L2_FRONTEND_URL } from '../../api/client';

interface PatientProfile {
  patient_id: string;
  full_name: string;
  email?: string;
  role: string;
}

interface VisitRecord {
  record_id: string;
  created_at: string;
  language: string;
  tb_risk_level?: string;
  tb_risk_score?: number;
  priority?: string;
  status: string;
  l2_referred?: boolean;
}

interface L2ReferralInfo {
  referred: boolean;
  referred_at?: string;
  referred_by?: string;
  notes?: string;
}

export function PatientProfilePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current');
  const [l2Info, setL2Info] = useState<L2ReferralInfo>({ referred: false });

  useEffect(() => {
    loadProfileData();
  }, []);

  // Re-check L2 status every 30s and on tab focus so banner appears without refresh
  useEffect(() => {
    const checkL2 = () => {
      patientApi.getL2Status()
        .then(res => {
          const l2Data = res.data as any;
          if (l2Data?.l2_referred) {
            setL2Info({
              referred:    true,
              referred_at: l2Data.l2_referred_at,
              referred_by: l2Data.l2_referred_by,
              notes:       l2Data.l2_referral_notes,
            });
          }
        })
        .catch(() => {});
    };

    const interval = setInterval(checkL2, 30000);
    window.addEventListener('focus', checkL2);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkL2);
    };
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      // Load records and L2 status in parallel
      const [recordsRes, l2Res] = await Promise.all([
        patientApi.getMyRecords(),
        patientApi.getL2Status(),
      ]);

      const allRecords: VisitRecord[] = (recordsRes.data as any[]) || [];
      setRecords(allRecords);

      // L2 status from dedicated endpoint
      const l2Data = l2Res.data as any;
      if (l2Data?.l2_referred) {
        setL2Info({
          referred:    true,
          referred_at: l2Data.l2_referred_at,
          referred_by: l2Data.l2_referred_by,
          notes:       l2Data.l2_referral_notes,
        });
      }

      // Profile from auth context (already loaded at app level)
      if (user) {
        setProfile({
          patient_id: user.user_id,
          full_name:  user.full_name,
          email:      user.email,
          role:       user.role,
        });
      }

    } catch (error) {
      console.error('Failed to load profile data:', error);
      showToast('Failed to load profile data', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk?: string): string => {
    switch (risk) {
      case 'high':   return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low':    return '#28a745';
      default:       return '#6c757d';
    }
  };

  const getPriorityColor = (priority?: string): string => {
    switch (priority) {
      case 'P1': return '#dc3545';
      case 'P2': return '#ffc107';
      case 'P3': return '#28a745';
      default:   return '#6c757d';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'prediction_complete': return '#28a745';
      case 'pending':             return '#007bff';
      default:                    return '#6c757d';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'prediction_complete': return 'Screened';
      case 'pending':             return 'In Progress';
      default:                    return status;
    }
  };

  // "current" = last 7 days; "past" = older
  const now = Date.now();
  const sevenDays = 7 * 86400000;
  const currentRecords = records.filter(r => now - new Date(r.created_at).getTime() < sevenDays);
  const pastRecords    = records.filter(r => now - new Date(r.created_at).getTime() >= sevenDays);
  const filteredRecords = activeTab === 'current' ? currentRecords : pastRecords;

  if (loading) {
    return (
      <AppLayout>
        <div className="vc-page">
          <div className="vc-page-header">
            <div className="vc-ph-title">Loading Profile</div>
            <div className="vc-ph-sub">Please wait...</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="processing-spinner"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-title">My Profile</div>
          <div className="vc-ph-sub">Your screening history and health records</div>
        </div>

        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* ── L2 TB Detection Referral Banner ─────────────────────────── */}
          {l2Info.referred && (
            <div
              className="vc-card"
              style={{
                marginBottom: 24,
                border: '1.5px solid #8b5cf6',
                background: 'rgba(139,92,246,0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                {/* Icon */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(139,92,246,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i className="bi-microscope" style={{ fontSize: 20, color: '#8b5cf6' }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#8b5cf6' }}>
                      L2 TB Detection Recommended
                    </div>
                    <div
                      style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(139,92,246,0.18)',
                        color: '#8b5cf6',
                        border: '1px solid rgba(139,92,246,0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Action Required
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                    Your doctor has reviewed your L1 screening results and recommends
                    advanced TB detection tests. Please complete the L2 assessment.
                  </div>

                  {l2Info.referred_by && (
                    <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 2 }}>
                      <i className="bi-person-fill" style={{ marginRight: 5 }} />
                      Referred by {l2Info.referred_by}
                      {l2Info.referred_at && (
                        <span style={{ marginLeft: 8 }}>
                          &middot;{' '}
                          {new Date(l2Info.referred_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  )}

                  {l2Info.notes && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '7px 12px',
                        background: 'var(--bg3)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text2)',
                        fontStyle: 'italic',
                        borderLeft: '3px solid rgba(139,92,246,0.5)',
                      }}
                    >
                      <i className="bi-chat-left-text" style={{ marginRight: 6 }} />
                      {l2Info.notes}
                    </div>
                  )}

                  {/* CTA — opens L2 TB Detection frontend */}
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a
                      href={L2_FRONTEND_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vc-btn"
                      style={{
                        background: '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi-box-arrow-up-right" />
                      Open L2 TB Detection
                    </a>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--text4)',
                      }}
                    >
                      <i className="bi-info-circle" />
                      Opens in a new tab &mdash; complete all 3 test modules (X-ray, Blood, Lab)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profile Card */}
          {profile && (
            <div className="vc-card" style={{ marginBottom: 24 }}>
              <div className="vc-sec-title" style={{ marginBottom: 20 }}>
                <i className="bi-person-circle" /> Patient Information
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>Patient ID</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', fontFamily: 'var(--mono)' }}>
                    {profile.patient_id.slice(-12).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>Full Name</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{profile.full_name}</div>
                </div>
                {profile.email && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>Email</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{profile.email}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>Total Screenings</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{records.length}</div>
                </div>
                {records.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>Last Screening</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>
                      {new Date(records[0].created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </div>
                  </div>
                )}
                {records.length > 0 && records[0].language && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 4 }}>Preferred Language</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>
                      {records[0].language.charAt(0).toUpperCase() + records[0].language.slice(1)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Screening Records Section */}
          <div className="vc-card">
            <div className="vc-sec-title" style={{ marginBottom: 20 }}>
              <i className="bi-calendar3" /> Screening Records
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
              <button
                className={`vc-btn vc-btn-${activeTab === 'current' ? 'teal' : 'ghost'}`}
                onClick={() => setActiveTab('current')}
                style={{
                  borderBottom: activeTab === 'current' ? '2px solid var(--teal)' : 'none',
                  borderRadius: '8px 8px 0 0',
                  marginBottom: -1,
                }}
              >
                <i className="bi-clock-fill" /> Recent (7 days) ({currentRecords.length})
              </button>
              <button
                className={`vc-btn vc-btn-${activeTab === 'past' ? 'teal' : 'ghost'}`}
                onClick={() => setActiveTab('past')}
                style={{
                  borderBottom: activeTab === 'past' ? '2px solid var(--teal)' : 'none',
                  borderRadius: '8px 8px 0 0',
                  marginBottom: -1,
                }}
              >
                <i className="bi-clock-history" /> Older ({pastRecords.length})
              </button>
            </div>

            {/* Records List */}
            <div style={{ minHeight: 200 }}>
              {filteredRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text4)' }}>
                  <i className="bi-calendar-x" style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                  <div style={{ fontSize: 16 }}>
                    {activeTab === 'current' ? 'No screenings in the last 7 days' : 'No older screenings'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredRecords.map((record) => {
                    const riskCol     = getRiskColor(record.tb_risk_level);
                    const priorityCol = getPriorityColor(record.priority);
                    return (
                      <div
                        key={record.record_id}
                        className="vc-card"
                        style={{
                          padding: '16px 20px',
                          border: `1px solid var(--border)`,
                          cursor: record.l2_referred ? 'pointer' : 'default',
                          transition: 'border-color 0.15s',
                        }}
                        onClick={() => {
                          if (record.l2_referred) window.open(L2_FRONTEND_URL, '_blank');
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>
                                TB Screening
                              </div>
                              {record.priority && (
                                <div style={{
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  backgroundColor: priorityCol + '15',
                                  color: priorityCol,
                                  border: `1px solid ${priorityCol}30`,
                                }}>
                                  {record.priority}
                                </div>
                              )}
                              {record.l2_referred && (
                                <div style={{
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(139,92,246,0.15)',
                                  color: '#8b5cf6',
                                  border: '1px solid rgba(139,92,246,0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}>
                                  <i className="bi-microscope" style={{ fontSize: 10 }} />
                                  L2 Referred · Click to open
                                </div>
                              )}
                            </div>

                            {record.tb_risk_level && (
                              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                                <i className="bi-activity" style={{ marginRight: 6 }} />
                                TB Risk:{' '}
                                <span style={{ color: riskCol, fontWeight: 600, textTransform: 'uppercase' }}>
                                  {record.tb_risk_level}
                                </span>
                                {record.tb_risk_score !== undefined && (
                                  <span style={{ color: 'var(--text4)', marginLeft: 6 }}>({record.tb_risk_score}%)</span>
                                )}
                              </div>
                            )}

                            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                              <i className="bi-calendar-fill" style={{ marginRight: 6 }} />
                              {new Date(record.created_at).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>

                            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                              <i className="bi-translate" style={{ marginRight: 6 }} />
                              {record.language}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{
                              padding: '6px 12px',
                              borderRadius: 16,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: getStatusColor(record.status) + '15',
                              color: getStatusColor(record.status),
                              border: `1px solid ${getStatusColor(record.status)}30`,
                            }}>
                              {getStatusLabel(record.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              className="vc-btn vc-btn-teal"
              onClick={() => navigate('/patient/questions')}
              style={{ flex: 1 }}
            >
              <i className="bi-plus-circle" /> New Screening
            </button>
            <button
              className="vc-btn vc-btn-ghost"
              onClick={() => navigate('/patient/history')}
            >
              <i className="bi-clock-history" /> Full History
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
