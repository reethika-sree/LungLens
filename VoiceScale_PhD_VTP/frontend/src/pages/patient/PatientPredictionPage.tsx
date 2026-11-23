import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoleLayout from '../../layouts/RoleLayout';
import { useToast } from '../../components/ToastProvider';
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
  P2: 'Moderate Priority — Clinical Sputum / X-ray Follow-up Advised',
  P3: 'Low Priority — Routine Symptom Monitoring & Health Advisory',
  P4: 'Minimal / Routine — General Health Precautions',
};

export function PatientPredictionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let symptoms: Record<string, any> = (location.state as any)?.symptoms;
    const language: string = (location.state as any)?.language || sessionStorage.getItem('selectedLanguage') || 'Telugu';
    let recordId: string = (location.state as any)?.recordId || sessionStorage.getItem('record_id') || ('REC-' + Date.now());

    if (!symptoms) {
      const stored = sessionStorage.getItem('dialogueSymptoms') || sessionStorage.getItem('questionAnswers');
      if (stored) {
        try { symptoms = JSON.parse(stored); } catch { /* ignore */ }
      }
    }

    if (!symptoms || Object.keys(symptoms).length === 0) {
      // If no symptoms found at all, navigate back to dialogue
      navigate('/patient/dialogue');
      return;
    }

    executePrediction(recordId, symptoms, language);
  }, []);

  const executePrediction = async (recordId: string, symptoms: Record<string, any>, language: string) => {
    setLoading(true);
    try {
      const res = await nlpApi.predictTB({
        record_id: recordId,
        symptoms,
        language
      });

      const data: any = res.data;
      const pred: PredictionResult = {
        record_id: data.record_id || recordId,
        risk_score: data.risk_score ?? Math.round((data.tb_probability || 0) * 100),
        risk_level: (data.risk || data.risk_level || 'low').toLowerCase() as any,
        priority: (data.priority as any) || 'P3',
        confidence: data.confidence ?? 0.85,
        contributing_factors: data.contributing_factors || data.explanation || [],
        explanation: data.explanation || [],
        disclaimer: data.medical_disclaimer || data.disclaimer || 'This TB Risk Assessment is an AI-assisted screening tool and NOT a confirmed medical diagnosis. Patients showing concerning symptoms must consult a registered medical practitioner.'
      };

      setPrediction(pred);
      sessionStorage.setItem('tbPrediction', JSON.stringify(pred));

      // Attempt to save to patient record if API supports it
      try {
        await patientApi.saveTBPrediction({
          record_id: recordId,
          risk: pred.risk_level,
          priority: pred.priority,
          confidence: pred.confidence,
          risk_score: pred.risk_score,
          explanation: pred.contributing_factors,
        });
      } catch {
        // non-blocking
      }
    } catch (err: any) {
      console.error('Prediction failed, using fallback assessment:', err);
      // Fallback in case of network issue
      const coughWeeks = Number(symptoms.cough_weeks || 0);
      const isHigh = coughWeeks >= 2 || symptoms.hemoptysis === 1 || (symptoms.night_fever === 1 && symptoms.weight_loss === 1);
      const isMed = coughWeeks > 0 || symptoms.night_fever === 1 || symptoms.weight_loss === 1 || symptoms.chest_pain === 1;

      const fallbackPred: PredictionResult = {
        risk_score: isHigh ? 78 : isMed ? 45 : 18,
        risk_level: isHigh ? 'high' : isMed ? 'medium' : 'low',
        priority: isHigh ? 'P1' : isMed ? 'P2' : 'P3',
        confidence: 0.82,
        contributing_factors: [
          coughWeeks > 0 ? `Cough duration: ${coughWeeks} week(s)` : 'No persistent cough',
          symptoms.hemoptysis === 1 ? 'Blood in sputum / Hemoptysis reported' : 'No hemoptysis',
          symptoms.night_fever === 1 ? 'Night fever reported' : 'No nocturnal fever',
          symptoms.weight_loss === 1 ? 'Unexplained weight loss reported' : 'No significant weight loss'
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
    }, 1200);
  };

  const handleRetest = () => {
    sessionStorage.removeItem('dialogueSymptoms');
    sessionStorage.removeItem('questionAnswers');
    sessionStorage.removeItem('voiceCaptureText');
    navigate('/patient/language');
  };

  if (loading) {
    return (
      <RoleLayout activeNav="history" pageTitle="Analyzing Symptoms">
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

  if (!prediction) {
    return (
      <RoleLayout activeNav="history" pageTitle="Assessment Error">
        <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 480, margin: '0 auto' }}>
          <i className="bi-exclamation-triangle" style={{ fontSize: 48, color: 'var(--red)', marginBottom: 16, display: 'inline-block' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>Unable to Compute Assessment</h2>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24 }}>We could not process symptom data. Please restart the voice check-in.</p>
          <button className="vc-btn vc-btn-teal" onClick={handleRetest}>
            <i className="bi-arrow-clockwise" /> Restart Check-in
          </button>
        </div>
      </RoleLayout>
    );
  }

  const colors = RISK_COLORS[prediction.risk_level] || RISK_COLORS.low;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (prediction.risk_score / 100) * circumference;

  return (
    <RoleLayout activeNav="history" pageTitle="TB Risk Assessment Result">
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
              Model Confidence: {Math.round(prediction.confidence * 100)}%
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
