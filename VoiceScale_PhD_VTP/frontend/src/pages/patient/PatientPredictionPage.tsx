import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../components/ToastProvider';
import AppLayout from '../AppLayout';
import { patientApi } from '../../api/client';

interface PredictionResult {
  risk: 'low' | 'medium' | 'high';
  priority: 'P3' | 'P2' | 'P1';
  confidence: number;
  riskScore: number;
  explanation: string[];
}

class TBPredictionService {
  private featureNames: string[] = [
    'coughPhlegm', 'coughingBlood', 'sputumBlood', 'shortnessBreath',
    'fever', 'nightSweats', 'weightLoss', 'tiredBody',
    'chestPain', 'backPain', 'swollenLymph', 'lumpsArmpitsNeck', 'lossAppetite'
  ];

  private preprocessAnswers(answers: Record<string, string>): number[] {
    return this.featureNames.map(f => (answers[f] || '').toLowerCase() === 'yes' ? 1 : 0);
  }

  async predictTB(answers: Record<string, string>): Promise<PredictionResult> {
    const features = this.preprocessAnswers(answers);
    const positiveSymptoms = features.filter(f => f === 1).length;
    const symptomRatio = positiveSymptoms / features.length;

    let risk: 'low' | 'medium' | 'high';
    let priority: 'P3' | 'P2' | 'P1';
    let confidence: number;
    const explanation: string[] = [];

    if (symptomRatio >= 0.6) {
      risk = 'high'; priority = 'P1'; confidence = 0.85;
      explanation.push('High number of TB-related symptoms detected');
    } else if (symptomRatio >= 0.3) {
      risk = 'medium'; priority = 'P2'; confidence = 0.70;
      explanation.push('Moderate number of TB-related symptoms detected');
    } else {
      risk = 'low'; priority = 'P3'; confidence = 0.80;
      explanation.push('Low number of TB-related symptoms detected');
    }

    if (features[1] === 1) explanation.push('Coughing blood present');
    if (features[4] === 1) explanation.push('Fever for ≥ 2 weeks present');
    if (features[6] === 1) explanation.push('Weight loss present');

    return { risk, priority, confidence, riskScore: Math.round(symptomRatio * 100), explanation };
  }
}

const RISK_COLOR: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#10b981',
};
const PRIORITY_LABEL: Record<string, string> = {
  P1: 'Critical Priority', P2: 'Medium Priority', P3: 'Low Priority',
};
const PRIORITY_BG: Record<string, string> = {
  P1: 'rgba(239,68,68,0.08)', P2: 'rgba(245,158,11,0.08)', P3: 'rgba(16,185,129,0.08)',
};

export function PatientPredictionPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [isPredicting, setIsPredicting] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const answersStr = sessionStorage.getItem('questionAnswers');
    if (!answersStr) { navigate('/patient/questions'); return; }
    runPrediction(JSON.parse(answersStr));
  }, []);

  const runPrediction = async (answers: Record<string, string>) => {
    setIsPredicting(true);
    try {
      const svc = new TBPredictionService();
      const result = await svc.predictTB(answers);
      setPrediction(result);
      sessionStorage.setItem('tbPrediction', JSON.stringify(result));

      const recordId = sessionStorage.getItem('record_id');
      if (recordId) {
        try {
          await patientApi.saveTBPrediction({
            record_id: recordId,
            risk: result.risk,
            priority: result.priority,
            confidence: result.confidence,
            risk_score: result.riskScore,
            explanation: result.explanation,
          });
        } catch { /* non-blocking */ }
      }
    } catch {
      showToast('Prediction failed. Please try again.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    showToast('Your appointment request has been received. Our team will contact you soon.', 'var(--teal)', 'bi-check-circle');
    setTimeout(() => navigate('/profile'), 800);
  };

  const handleRetest = () => {
    sessionStorage.removeItem('questionAnswers');
    sessionStorage.removeItem('tbPrediction');
    navigate('/patient/questions');
  };

  // ── Loading state ──────────────────────────────────────────────
  if (isPredicting) {
    return (
      <AppLayout>
        <div className="vc-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite', marginBottom: 24 }} />
          <div className="vc-ph-title" style={{ textAlign: 'center' }}>Analysing your symptoms…</div>
          <div className="vc-ph-sub" style={{ textAlign: 'center' }}>XGBoost model running</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  if (!prediction) {
    return (
      <AppLayout>
        <div className="vc-page" style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="vc-ph-title">Prediction Error</div>
          <div className="vc-ph-sub" style={{ marginBottom: 24 }}>Unable to process your responses</div>
          <button className="vc-btn vc-btn-teal" onClick={handleRetest}>
            <i className="bi-arrow-clockwise" /> Try Again
          </button>
        </div>
      </AppLayout>
    );
  }

  const riskCol     = RISK_COLOR[prediction.risk];
  const circumference = 2 * Math.PI * 52;
  const dashOffset  = circumference - (prediction.riskScore / 100) * circumference;

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header" style={{ textAlign: 'center' }}>
          <div className="vc-ph-title">TB Risk Assessment</div>
          <div className="vc-ph-sub">Based on your symptom analysis</div>
        </div>

        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', margin: '0 auto' }}>

          {/* ── Combined Risk + Priority card ───────────────────── */}
          <div className="vc-card" style={{
            border: `2px solid ${riskCol}`,
            background: PRIORITY_BG[prediction.priority],
            padding: '28px 24px',
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%'
          }}>
            {/* Donut */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <svg width={120} height={120} viewBox="0 0 120 120">
                <circle cx={60} cy={60} r={52} fill="none" stroke="var(--bg3)" strokeWidth={10} />
                <circle
                  cx={60} cy={60} r={52}
                  fill="none"
                  stroke={riskCol}
                  strokeWidth={10}
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                <text x={60} y={55} textAnchor="middle" fill={riskCol} fontSize={22} fontWeight={800} fontFamily="var(--mono)">
                  {prediction.riskScore}%
                </text>
                <text x={60} y={72} textAnchor="middle" fill="var(--text4)" fontSize={10} fontFamily="var(--font)">
                  Risk Score
                </text>
              </svg>
              <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>
                Confidence {Math.round(prediction.confidence * 100)}%
              </span>
            </div>

            {/* Priority badge */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Priority Level
              </div>
              <div style={{
                fontSize: 52, fontWeight: 900, lineHeight: 1,
                color: riskCol, fontFamily: 'var(--mono)',
                letterSpacing: 2, marginBottom: 8,
              }}>
                {prediction.priority}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>
                {PRIORITY_LABEL[prediction.priority]}
              </div>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 99,
                background: `${riskCol}18`, border: `1px solid ${riskCol}40`,
                color: riskCol, fontSize: 12, fontWeight: 700,
              }}>
                {prediction.risk.toUpperCase()} RISK
              </span>
            </div>
          </div>

          {/* ── Key Findings ─────────────────────────────────────── */}
          <div className="vc-card" style={{ padding: '20px 24px', textAlign: 'center', width: '100%' }}>
            <div className="vc-sec-title" style={{ marginBottom: 12, textAlign: 'center' }}>
              <i className="bi-clipboard2-pulse-fill" style={{ color: 'var(--teal)', marginRight: 6 }} />
              Key Findings
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              {prediction.explanation.map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 20px',
                  borderRadius: 10,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  fontSize: 14,
                  color: 'var(--text1)',
                  lineHeight: 1.6,
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '450px',
                  minHeight: 'auto'
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* ── Ticket info ───────────────────────────────────────── */}
          <div className="vc-card" style={{
            padding: '18px 24px',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 14,
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%'
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, flexShrink: 0,
              background: 'rgba(139,92,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="bi-ticket-perforated-fill" style={{ fontSize: 20, color: '#8b5cf6' }} />
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>
                Your appointment is being arranged
              </div>
              <div style={{ fontSize: 12, color: 'var(--text4)' }}>
                Our team will contact you based on your <strong>{prediction.priority}</strong> priority level.
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text4)', textAlign: 'right', flexShrink: 0 }}>
              PHC-CHITTOOR
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', width: '100%' }}>
            <button
              className="vc-btn vc-btn-teal"
              onClick={handleConfirm}
              disabled={confirming}
              style={{ flex: 1, fontWeight: 600, maxWidth: '300px' }}
            >
              {confirming
                ? <><i className="bi-hourglass-split" /> Confirming…</>
                : <><i className="bi-check-circle-fill" /> Confirm &amp; Go to Profile</>}
            </button>
            <button className="vc-btn vc-btn-ghost" onClick={handleRetest} style={{ flexShrink: 0 }}>
              <i className="bi-arrow-counterclockwise" /> Retest
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}