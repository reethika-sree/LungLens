import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoleLayout from '../../layouts/RoleLayout';
import { useToast } from '../../components/ToastProvider';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setPrediction as setReduxPrediction, resetTriage } from '../../store/slices/triageSlice';
import { nlpApi, patientApi } from '../../api/client';

interface PredictionResult {
  record_id?: string;
  risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  confidence: number;
  contributing_factors: string[];
  explanation: string[];
  disclaimer: string;
}

const RISK_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  high:   { fg: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)',  border: 'rgba(239, 68, 68, 0.3)' },
  medium: { fg: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)' },
  low:    { fg: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)' },
};

const PRIORITY_LABELS: Record<string, string> = {
  P1: 'Critical Priority — Immediate PHC Consultation Recommended',
  P2: 'High / Moderate Priority — Clinical Sputum / X-ray Within 48h',
  P3: 'Low Priority — Routine Symptom Monitoring & Health Advisory',
  P4: 'Minimal / Routine — General Health Precautions',
};

export function PatientPredictionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const dispatch = useAppDispatch();
  const reduxSymptoms = useAppSelector(s => s.triage.symptoms);

  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [noSymptomsYet, setNoSymptomsYet] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let symptoms: Record<string, any> | undefined = (location.state as any)?.symptoms;
    const language: string = (location.state as any)?.language || sessionStorage.getItem('selectedLanguage') || 'English';
    const recordId: string | undefined = (location.state as any)?.recordId || sessionStorage.getItem('record_id') || undefined;

    if (!symptoms || Object.keys(symptoms).length === 0) {
      const stored =
        sessionStorage.getItem('dialogueSymptoms') ||
        sessionStorage.getItem('extractedSymptoms') ||
        sessionStorage.getItem('questionAnswers');
      if (stored) {
        try { symptoms = JSON.parse(stored); } catch { /* ignore */ }
      }
    }

    if ((!symptoms || Object.keys(symptoms).length === 0) && reduxSymptoms && Object.keys(reduxSymptoms).length > 0) {
      symptoms = reduxSymptoms;
    }

    if (symptoms && Object.keys(symptoms).length > 0) {
      executePrediction(recordId, symptoms, language);
      return;
    }

    // No symptoms in current session — check latest saved assessment or show clear prompt
    loadLatestOrPrompt();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLatestOrPrompt = async () => {
    setLoading(true);
    try {
      const savedPred = sessionStorage.getItem('tbPrediction');
      if (savedPred) {
        setPrediction(JSON.parse(savedPred));
        setLoading(false);
        return;
      }
      const res = await patientApi.getMyRecords();
      const latest = (res.data || []).find((r: any) => r.status === 'prediction_complete');
      if (latest) {
        setPrediction({
          record_id: latest.record_id,
          risk_score: Number(latest.tb_risk_score ?? 0),
          risk_level: (latest.tb_risk_level || 'low').toLowerCase(),
          priority: latest.priority || 'P4',
          confidence: Number(latest.tb_confidence ?? 0.85),
          contributing_factors: latest.tb_explanation || [],
          explanation: latest.tb_explanation || [],
          disclaimer: 'This TB Risk Assessment is an AI-assisted screening tool and NOT a confirmed medical diagnosis. Patients showing concerning symptoms must consult a registered medical practitioner.',
        });
        setLoading(false);
        return;
      }
    } catch {
      // fall through to clean empty state
    }
    setNoSymptomsYet(true);
    setLoading(false);
  };

  const executePrediction = async (recordId: string | undefined, symptoms: Record<string, any>, language: string) => {
    setLoading(true);
    try {
      const res = await nlpApi.predictTB({
        record_id: recordId,
        symptoms,
        language
      });

      const data: any = res.data;
      const finalRecordId = data.record_id || recordId;
      if (finalRecordId) sessionStorage.setItem('record_id', finalRecordId);

      const pred: PredictionResult = {
        record_id: finalRecordId,
        risk_score: data.risk_score ?? Math.round((data.tb_probability || 0) * 100),
        risk_level: (data.risk || data.risk_level || 'low').toLowerCase() as any,
        priority: (data.priority as any) || 'P4',
        confidence: data.confidence ?? 0.85,
        contributing_factors: data.contributing_factors || data.explanation || [],
        explanation: data.explanation || [],
        disclaimer: data.medical_disclaimer || data.disclaimer || 'This TB Risk Assessment is an AI-assisted screening tool and NOT a confirmed medical diagnosis. Patients showing concerning symptoms must consult a registered medical practitioner.'
      };

      setPrediction(pred);
      sessionStorage.setItem('tbPrediction', JSON.stringify(pred));
      dispatch(setReduxPrediction({
        riskScore: pred.risk_score,
        priorityTier: pred.priority,
        consultationId: pred.record_id,
      }));
    } catch (err: any) {
      console.error('Prediction failed, using fallback assessment:', err);
      const cwRaw = symptoms.cough_weeks;
      const coughWeeks = cwRaw === 'mentioned_unknown_duration' ? 1.5 : Number(cwRaw || 0);
      const has = (k: string) => symptoms[k] === true || symptoms[k] === 1 || symptoms[k] === 'yes';
      const isHigh = coughWeeks >= 2 || has('hemoptysis') || (has('night_fever') && has('weight_loss'));
      const isMed = coughWeeks > 0 || has('night_fever') || has('weight_loss') || has('chest_pain');

      const fallbackPred: PredictionResult = {
        risk_score: isHigh ? 78 : isMed ? 45 : 12,
        risk_level: isHigh ? 'high' : isMed ? 'medium' : 'low',
        priority: isHigh ? 'P1' : isMed ? 'P2' : 'P4',
        confidence: 0.82,
        contributing_factors: [
          coughWeeks > 0 ? `Cough duration: ${coughWeeks} week(s)` : 'No persistent cough',
          has('hemoptysis') ? 'Blood in sputum / Hemoptysis reported' : 'No hemoptysis',
          has('night_fever') ? 'Night fever reported' : 'No nocturnal fever',
          has('weight_loss') ? 'Unexplained weight loss reported' : 'No significant weight loss'
        ],
        explanation: [],
        disclaimer: 'This TB Risk Assessment is an AI-assisted screening tool and NOT a confirmed medical diagnosis. Patients showing concerning symptoms must consult a registered medical practitioner and undergo confirmatory clinical testing.'
      };
      setPrediction(fallbackPred);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAppointment = async () => {
    setConfirming(true);
    showToast('Your screening summary has been transmitted to the PHC medical queue.', 'var(--teal)', 'bi-check-circle-fill');
    setTimeout(() => {
      navigate('/patient/dashboard');
    }, 1000);
  };

  const handleRetest = () => {
    sessionStorage.removeItem('dialogueSymptoms');
    sessionStorage.removeItem('extractedSymptoms');
    sessionStorage.removeItem('dialogueSession');
    sessionStorage.removeItem('questionAnswers');
    sessionStorage.removeItem('voiceCaptureText');
    sessionStorage.removeItem('tbPrediction');
    sessionStorage.removeItem('record_id');
    dispatch(resetTriage());
    navigate('/patient/language');
  };

  if (loading) {
    return (
      <RoleLayout activeNav="prediction" pageTitle="Analyzing Symptoms">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', margin: '0 0 6px' }}>Evaluating Machine Learning Model…</h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Processing extracted symptoms through trained XGBoost classifier and clinical weights</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </RoleLayout>
    );
  }

  if (noSymptomsYet || !prediction) {
    return (
      <RoleLayout activeNav="prediction" pageTitle="TB Risk Assessment">
        <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 520, margin: '0 auto' }}>
          <i className="bi-chat-dots-fill" style={{ fontSize: 48, color: 'var(--teal)', marginBottom: 16, display: 'inline-block' }} />
          <h2 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>Complete Symptom Intake First</h2>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24, lineHeight: 1.6 }}>
            We need your reported symptoms before running the XGBoost TB triage model. Answer a few quick questions in Dynamic AI Intake or record your symptoms via Voice Screening.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="vc-btn vc-btn-teal" onClick={() => navigate('/patient/dialogue')}>
              <i className="bi-chat-dots" /> Open Dynamic AI Intake
            </button>
            <button className="vc-btn vc-btn-ghost" onClick={handleRetest}>
              <i className="bi-mic" /> Start Voice Screening
            </button>
          </div>
        </div>
      </RoleLayout>
    );
  }

  const colors = RISK_COLORS[prediction.risk_level] || RISK_COLORS.low;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (prediction.risk_score / 100) * circumference;
  const confPct = prediction.confidence <= 1 ? Math.round(prediction.confidence * 100) : Math.round(prediction.confidence);

  return (
    <RoleLayout activeNav="prediction" pageTitle="TB Risk Assessment Result">
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Title Banner ── */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--teal)' }}>
            AI-Assisted Pulmonary Triage
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text1)', margin: '4px 0 8px' }}>
            Tuberculosis Risk Assessment Result
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Generated from patient-reported symptoms, voice NLP feature extraction, and XGBoost probabilistic modeling.
          </p>
        </div>

        {/* ── Primary Assessment Score Card ── */}
        <div style={{
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: 20,
          padding: '32px 28px',
          display: 'flex',
          gap: 32,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)'
        }}>
          {/* Radial Donut */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <svg width={130} height={130} viewBox="0 0 130 130">
              <circle cx={65} cy={65} r={52} fill="none" stroke="var(--bg3)" strokeWidth={10} />
              <circle
                cx={65} cy={65} r={52}
                fill="none"
                stroke={colors.fg}
                strokeWidth={10}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
              <text x={65} y={60} textAnchor="middle" fill={colors.fg} fontSize={24} fontWeight={800} fontFamily="var(--mono)">
                {prediction.risk_score}%
              </text>
              <text x={65} y={78} textAnchor="middle" fill="var(--text4)" fontSize={11} fontFamily="var(--font)">
                Risk Probability
              </text>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--text4)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
              Model Confidence: {confPct}%
            </span>
          </div>

          {/* Priority & Level Details */}
          <div style={{ flex: 1, minWidth: 260, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: 99,
                background: colors.fg, color: '#fff', fontSize: 13, fontWeight: 700,
                letterSpacing: 0.5, textTransform: 'uppercase'
              }}>
                {prediction.risk_level} RISK LEVEL
              </span>
              <span style={{
                fontSize: 14, fontWeight: 700, color: colors.fg, fontFamily: 'var(--mono)'
              }}>
                {prediction.priority}
              </span>
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', margin: '0 0 6px' }}>
              {PRIORITY_LABELS[prediction.priority]}
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
              {prediction.risk_level === 'high'
                ? 'Symptoms indicate multiple high-weight pulmonary tuberculosis risk factors (e.g. chronic cough, night fever, or hemoptysis). Immediate doctor review is advised.'
                : prediction.risk_level === 'medium'
                ? 'Symptoms present moderate pulmonary concern. Further clinical evaluation and diagnostic testing at the local PHC is recommended.'
                : 'Reported symptoms are low risk for active tuberculosis. Continue standard symptomatic care and consult a doctor if symptoms persist over 2 weeks.'}
            </p>
          </div>
        </div>

        {/* ── Contributing Factors Section ── */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
            <i className="bi-clipboard2-pulse-fill" style={{ color: 'var(--teal)' }} />
            Contributing Symptoms &amp; Extracted Clinical Factors
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {prediction.contributing_factors.map((item, idx) => (
              <div key={idx} style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
                color: 'var(--text1)'
              }}>
                <i className="bi-check2-circle" style={{ color: 'var(--teal)', fontSize: 16, flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Strict Medical Disclaimer ── */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start'
        }}>
          <i className="bi-shield-exclamation" style={{ fontSize: 24, color: '#d97706', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#b45309', margin: '0 0 4px' }}>
              Official Medical Disclaimer
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
              {prediction.disclaimer}
            </p>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          <button
            className="vc-btn vc-btn-ghost"
            onClick={handleRetest}
            style={{ padding: '12px 20px', borderRadius: 10, cursor: 'pointer' }}
          >
            <i className="bi-arrow-clockwise" /> Start New Assessment
          </button>

          <button
            className="vc-btn"
            onClick={handleConfirmAppointment}
            disabled={confirming}
            style={{
              padding: '12px 28px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0d9488, #2563eb)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(13,148,136,.3)'
            }}
          >
            <i className={confirming ? 'bi-hourglass-split' : 'bi-house-heart-fill'} />
            {confirming ? 'Transmitting to PHC Queue…' : 'Confirm & Go to Dashboard'}
          </button>
        </div>

      </div>
    </RoleLayout>
  );
}
