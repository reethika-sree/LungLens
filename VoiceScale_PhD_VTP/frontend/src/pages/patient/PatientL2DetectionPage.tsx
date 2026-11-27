import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import RoleLayout from '../../layouts/RoleLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ToastProvider';
import { l2Api, patientApi } from '../../api/client';
import '../../styles/Dashboard.css';
import './PatientL2DetectionPage.css';

type TabKey = 'xray' | 'blood' | 'lab' | 'final';

interface ModuleResult {
  module?: string;
  tb_positive: boolean | null;
  confidence: number;
  probability?: number;
  rifampicin_resistant?: boolean | null;
  risk_level?: string;
  recommendation?: string;
  contributing_factors?: { test: string; result: string; contribution: string }[];
  message?: string;
}

const NAV_TABS: { id: TabKey; icon: string; label: string; desc: string; num: string; highlight?: boolean }[] = [
  { id: 'xray',  icon: '🫁', label: 'Chest X-ray',     desc: 'Radiographic analysis', num: '01' },
  { id: 'blood', icon: '🩸', label: 'Blood Test',      desc: 'Biomarker analysis',    num: '02' },
  { id: 'lab',   icon: '🧬', label: 'Lab / GeneXpert', desc: 'Molecular test results', num: '03' },
  { id: 'final', icon: '📋', label: 'Final Report',    desc: 'Fused clinical decision', num: '04', highlight: true },
];

const XRAY_FINDINGS = [
  'Pulmonary infiltrates & consolidation',
  'Upper lobe opacities (classic TB pattern)',
  'Cavitary lesions',
  'Hilar lymphadenopathy',
  'Pleural effusion',
];

const BLOOD_FIELDS = [
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL',     placeholder: '12.0 – 17.5', normal: '12.0 – 17.5', min: 1,   max: 25,  step: 0.1, icon: '🔴', info: 'Low Hb (anaemia) is common in TB due to chronic inflammation.', normalMin: 12.0, normalMax: 17.5 },
  { key: 'wbc_count',  label: 'WBC Count',  unit: '×10³/µL',  placeholder: '4.0 – 11.0',  normal: '4.0 – 11.0',  min: 0.5, max: 50,  step: 0.1, icon: '⚪', info: 'Elevated WBC (leukocytosis) signals active infection or immune response.', normalMin: 4.0, normalMax: 11.0 },
  { key: 'esr',        label: 'ESR',        unit: 'mm/hr',    placeholder: '0 – 20',      normal: '< 20',        min: 0,   max: 150, step: 1,   icon: '📉', info: 'Erythrocyte Sedimentation Rate — markedly elevated in active TB.', normalMin: 0, normalMax: 20 },
  { key: 'crp',        label: 'CRP',        unit: 'mg/L',     placeholder: '0 – 10',      normal: '< 10',        min: 0,   max: 300, step: 0.5, icon: '🔥', info: 'C-Reactive Protein — acute-phase inflammatory marker elevated in TB.', normalMin: 0, normalMax: 10 },
];

const GENEXPERT_OPTS = [
  { value: 'positive',      label: 'Positive',      icon: '⊕', color: 'danger' },
  { value: 'negative',      label: 'Negative',      icon: '⊖', color: 'success' },
  { value: 'indeterminate', label: 'Indeterminate', icon: '⊘', color: 'warning' },
] as const;

const RIFAMPICIN_OPTS = [
  { value: 'yes',           label: 'Detected',      icon: '⊕', color: 'danger' },
  { value: 'no',            label: 'Not Detected',  icon: '⊖', color: 'success' },
  { value: 'indeterminate', label: 'Indeterminate', icon: '⊘', color: 'warning' },
] as const;

function L2ResultCard({ result }: { result: ModuleResult }) {
  const isPos = result.tb_positive === true;
  const isNeg = result.tb_positive === false;
  const cls = isPos ? 'pos' : isNeg ? 'neg' : 'unk';
  const color = isPos ? 'var(--red)' : isNeg ? 'var(--teal)' : 'var(--amber)';
  const label = isPos ? '⚠ TB POSITIVE' : isNeg ? '✓ TB NEGATIVE' : '? INDETERMINATE';

  return (
    <div className={`l2-result-card ${cls}`}>
      <div className="l2-res-head">
        <div className="l2-res-status" style={{ color }}>{label}</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Confidence</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
            {result.confidence?.toFixed(1)}%
          </div>
        </div>
      </div>

      {result.confidence != null && (
        <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(result.confidence, 100)}%`, background: color, borderRadius: 4 }} />
        </div>
      )}

      {result.probability != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>TB Probability</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)' }}>{result.probability.toFixed(1)}%</span>
        </div>
      )}

      {result.rifampicin_resistant != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Rifampicin Resistance</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: result.rifampicin_resistant ? 'var(--red)' : 'var(--teal)' }}>
            {result.rifampicin_resistant ? 'DETECTED' : 'Not Detected'}
          </span>
        </div>
      )}

      {result.message && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>{result.message}</p>
      )}
    </div>
  );
}

export default function PatientL2DetectionPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('xray');
  const [results, setResults] = useState<{
    xray: ModuleResult | null;
    blood: ModuleResult | null;
    lab: ModuleResult | null;
    final: ModuleResult | null;
  }>({ xray: null, blood: null, lab: null, final: null });

  // Module 01 — Chest X-ray state
  const [xrayFile, setXrayFile] = useState<File | null>(null);
  const [xrayPreview, setXrayPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [xrayLoading, setXrayLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Module 02 — Blood Test state
  const [bloodValues, setBloodValues] = useState<Record<string, string>>({
    hemoglobin: '', wbc_count: '', esr: '', crp: '',
  });
  const [bloodErrors, setBloodErrors] = useState<Record<string, string>>({});
  const [bloodLoading, setBloodLoading] = useState(false);

  // Module 03 — Lab / GeneXpert state
  const [genexpert, setGenexpert] = useState('');
  const [rifampicin, setRifampicin] = useState('');
  const [labLoading, setLabLoading] = useState(false);

  // Module 04 — Final Fusion & PDF state
  const [finalLoading, setFinalLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [savedPdfName, setSavedPdfName] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const setModuleResult = (key: TabKey, data: ModuleResult | null) => {
    setResults(prev => ({ ...prev, [key]: data }));
  };

  // ── Module 01 Handlers ──────────────────────────────────────────────────────
  const handleSelectXrayFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(f.type)) {
      showToast('Please select a JPG or PNG image.', 'var(--red)', 'bi-exclamation-triangle');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      showToast('File size must be under 20 MB.', 'var(--red)', 'bi-exclamation-triangle');
      return;
    }
    setXrayFile(f);
    setXrayPreview(URL.createObjectURL(f));
    setModuleResult('xray', null);
  };

  const analyzeXray = async () => {
    if (!xrayFile) {
      showToast('Please upload a chest X-ray image first.', 'var(--amber)', 'bi-info-circle');
      return;
    }
    setXrayLoading(true);
    try {
      const { data } = await l2Api.predictXray(xrayFile);
      setModuleResult('xray', data);
      showToast('Chest X-ray analysis complete!', 'var(--teal)', 'bi-check-circle-fill');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'X-ray analysis failed.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setXrayLoading(false);
    }
  };

  // ── Module 02 Handlers ──────────────────────────────────────────────────────
  const getValueStatus = (field: typeof BLOOD_FIELDS[number], val: string) => {
    if (val === '') return 'empty';
    const v = parseFloat(val);
    if (isNaN(v)) return 'empty';
    return v < field.normalMin || v > field.normalMax ? 'abnormal' : 'normal';
  };

  const handleBloodChange = (key: string, val: string) => {
    setBloodValues(prev => ({ ...prev, [key]: val }));
    if (bloodErrors[key]) {
      setBloodErrors(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const loadBloodExample = (type: 'normal' | 'tb') => {
    setBloodValues(
      type === 'tb'
        ? { hemoglobin: '9.8', wbc_count: '13.5', esr: '68', crp: '52' }
        : { hemoglobin: '14.2', wbc_count: '7.1', esr: '8', crp: '3' }
    );
    setBloodErrors({});
    setModuleResult('blood', null);
  };

  const analyzeBlood = async () => {
    const errs: Record<string, string> = {};
    BLOOD_FIELDS.forEach(f => {
      const valStr = bloodValues[f.key];
      const v = parseFloat(valStr);
      if (valStr === '') errs[f.key] = 'Required';
      else if (isNaN(v)) errs[f.key] = 'Must be a number';
      else if (v < f.min) errs[f.key] = `Min ${f.min}`;
      else if (v > f.max) errs[f.key] = `Max ${f.max}`;
    });
    setBloodErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('Please fill all blood fields correctly.', 'var(--red)', 'bi-exclamation-triangle');
      return;
    }

    setBloodLoading(true);
    try {
      const payload = {
        hemoglobin: parseFloat(bloodValues.hemoglobin),
        wbc_count: parseFloat(bloodValues.wbc_count),
        esr: parseFloat(bloodValues.esr),
        crp: parseFloat(bloodValues.crp),
      };
      const { data } = await l2Api.predictBlood(payload);
      setModuleResult('blood', data);
      showToast('Blood test analysis complete!', 'var(--teal)', 'bi-check-circle-fill');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Blood test analysis failed.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setBloodLoading(false);
    }
  };

  // ── Module 03 Handlers ──────────────────────────────────────────────────────
  const analyzeLab = async () => {
    if (!genexpert || !rifampicin) {
      showToast('Please select GeneXpert and Rifampicin values.', 'var(--amber)', 'bi-info-circle');
      return;
    }
    setLabLoading(true);
    try {
      const { data } = await l2Api.predictLab({
        genexpert_result: genexpert,
        rifampicin_resistance: rifampicin,
      });
      setModuleResult('lab', data);
      showToast('GeneXpert lab result processed!', 'var(--teal)', 'bi-check-circle-fill');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Lab analysis failed.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setLabLoading(false);
    }
  };

  // ── Module 04 Handlers ──────────────────────────────────────────────────────
  const hasAny = Boolean(results.xray || results.blood || results.lab);

  const analyzeFinal = async () => {
    if (!hasAny) {
      showToast('Complete at least one diagnostic test first.', 'var(--amber)', 'bi-info-circle');
      return;
    }
    setFinalLoading(true);
    try {
      const payload = {
        // Normalize 0–100% outputs into 0–1 probability for weighted fusion
        xray_prob:  results.xray  && results.xray.probability  != null ? results.xray.probability  / 100.0 : null,
        blood_prob: results.blood && results.blood.probability != null ? results.blood.probability / 100.0 : null,
        lab_result: results.lab   ? results.lab.tb_positive : null,
      };
      const { data } = await l2Api.predictFinal(payload);
      setModuleResult('final', data);
      setSavedPdfName(null);
      showToast('Final fused TB report generated!', 'var(--teal)', 'bi-check-circle-fill');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Final analysis failed.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setFinalLoading(false);
    }
  };

  const buildReportPdf = async (): Promise<{ pdf: jsPDF; filename: string } | null> => {
    if (!results.final || !reportRef.current) {
      showToast('Please generate the final report first.', 'var(--amber)', 'bi-info-circle');
      return null;
    }
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0e1620',
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageH = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageH;
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageH;
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    return { pdf, filename: `LungLens_TB_Report_${ts}.pdf` };
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const built = await buildReportPdf();
      if (!built) return;
      built.pdf.save(built.filename);
      showToast(`Downloaded ${built.filename}`, 'var(--teal)', 'bi-check-circle-fill');
    } catch (err) {
      console.error(err);
      showToast('PDF generation failed.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setPdfLoading(false);
    }
  };

  const saveReportToPatientRecord = async () => {
    setSavingRecord(true);
    try {
      const built = await buildReportPdf();
      if (!built) return;
      const dataUri = built.pdf.output('datauristring');
      const base64 = dataUri.split(',')[1];
      await patientApi.uploadL2PDF({
        patient_id: user?.user_id || 'patient',
        pdf_data: base64,
        pdf_name: built.filename,
        report_type: 'l2_complete',
      });
      setSavedPdfName(built.filename);
      showToast('Report saved to your LungLens medical record!', 'var(--teal)', 'bi-check-circle-fill');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Could not save report to record.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setSavingRecord(false);
    }
  };

  const reportDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const bloodCompletedCount = BLOOD_FIELDS.filter(f => bloodValues[f.key] !== '').length;

  return (
    <RoleLayout activeNav="l2lab" pageTitle="L2 TB Detection">
      <div className="dash-container">
        <div className="l2-wrap">
          {/* ── Top Module Switcher Tabs ── */}
          <div className="l2-tabs">
            {NAV_TABS.map(tab => {
              const res = results[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`l2-tab ${activeTab === tab.id ? 'active' : ''} ${tab.highlight ? 'highlight' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className="l2-tab-left">
                    <span className="l2-tab-icon">{tab.icon}</span>
                    <div>
                      <div className="l2-tab-title">{tab.label}</div>
                      <div className="l2-tab-sub">{tab.desc}</div>
                    </div>
                  </div>
                  <div className="l2-tab-right">
                    {res && (
                      <span
                        className="l2-dot"
                        style={{ background: res.tb_positive ? 'var(--red)' : res.tb_positive === false ? 'var(--teal)' : 'var(--amber)' }}
                      />
                    )}
                    <span className="l2-num">{tab.num}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ══════════════════ MODULE 01 — CHEST X-RAY ══════════════════ */}
          {activeTab === 'xray' && (
            <>
              <div className="l2-panel-head">
                <div className="l2-mod-tag">— MODULE 01</div>
                <h2 className="l2-mod-title">Chest X-ray Analysis</h2>
                <p className="l2-mod-sub">
                  Upload a posteroanterior (PA) chest X-ray to detect TB-associated radiographic patterns with high sensitivity.
                </p>
              </div>

              <div className="l2-grid">
                <div className="l2-col">
                  <div
                    className={`l2-dropzone ${dragActive ? 'drag' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragActive(false);
                      handleSelectXrayFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      style={{ display: 'none' }}
                      onChange={e => handleSelectXrayFile(e.target.files?.[0])}
                    />
                    {xrayPreview ? (
                      <div className="l2-preview-wrap">
                        <img src={xrayPreview} alt="X-ray preview" className="l2-preview-img" />
                        <span style={{ fontSize: 12, color: 'var(--text4)' }}>Click or drop another image to replace</span>
                      </div>
                    ) : (
                      <div className="l2-drop-empty">
                        <div className="l2-drop-ring">🫁</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          Drag &amp; drop chest X-ray here
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text4)' }}>JPG or PNG · max 20 MB</div>
                        <span className="vc-btn vc-btn-ghost vc-btn-sm" style={{ marginTop: 6 }}>Browse files</span>
                      </div>
                    )}
                  </div>

                  {xrayFile && (
                    <div className="l2-file-bar">
                      <span><i className="bi-image" style={{ marginRight: 6 }} />{xrayFile.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{(xrayFile.size / 1024).toFixed(0)} KB</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="vc-btn vc-btn-teal"
                      style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                      onClick={analyzeXray}
                      disabled={!xrayFile || xrayLoading}
                    >
                      {xrayLoading ? 'Analyzing X-ray…' : '🔬 Analyze X-ray'}
                    </button>
                    {xrayFile && (
                      <button
                        type="button"
                        className="vc-btn vc-btn-ghost"
                        onClick={() => { setXrayFile(null); setXrayPreview(null); setModuleResult('xray', null); }}
                        title="Clear X-ray"
                      >
                        <i className="bi-x-lg" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="l2-col">
                  {results.xray ? (
                    <L2ResultCard result={results.xray} />
                  ) : (
                    <div className="l2-res-card-empty">
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Awaiting Analysis</div>
                      <div style={{ fontSize: 13 }}>Upload an X-ray and click Analyze X-ray to see results.</div>
                    </div>
                  )}

                  <div className="l2-info-box">
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>
                      DETECTION TARGETS
                    </div>
                    {XRAY_FINDINGS.map(txt => (
                      <div key={txt} style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--blue)' }}>◈</span>
                        <span>{txt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════ MODULE 02 — BLOOD TEST ══════════════════ */}
          {activeTab === 'blood' && (
            <>
              <div className="l2-panel-head">
                <div className="l2-mod-tag" style={{ color: 'var(--red)' }}>— MODULE 02</div>
                <h2 className="l2-mod-title">Blood Test Analysis</h2>
                <p className="l2-mod-sub">
                  Enter CBC and inflammatory marker values to evaluate TB-associated haematological patterns.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text4)', fontWeight: 600 }}>Quick fill:</span>
                <button type="button" className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => loadBloodExample('normal')}>
                  <span style={{ color: 'var(--teal)' }}>●</span> Healthy Patient
                </button>
                <button type="button" className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => loadBloodExample('tb')}>
                  <span style={{ color: 'var(--red)' }}>●</span> TB Patient
                </button>
              </div>

              <div className="l2-grid">
                <div className="l2-col">
                  {BLOOD_FIELDS.map(f => {
                    const status = getValueStatus(f, bloodValues[f.key]);
                    const err = bloodErrors[f.key];
                    return (
                      <div key={f.key} className={`l2-field-card ${err ? 'error' : status}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 18 }}>{f.icon}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{f.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--text4)' }}>{f.unit} · Ref {f.normal}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="number"
                              className="l2-field-input"
                              value={bloodValues[f.key]}
                              onChange={e => handleBloodChange(f.key, e.target.value)}
                              placeholder={f.placeholder}
                              min={f.min}
                              max={f.max}
                              step={f.step}
                            />
                            {status === 'normal' && <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700 }}>✓ Normal</span>}
                            {status === 'abnormal' && <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>⚠ Abnormal</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text4)' }}>{f.info}</div>
                        {err && <div style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 600 }}>{err}</div>}
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text4)' }}>
                      <span>Fields completed</span>
                      <span>{bloodCompletedCount} / {BLOOD_FIELDS.length}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(bloodCompletedCount / BLOOD_FIELDS.length) * 100}%`, background: 'var(--teal)', transition: 'width 0.25s' }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="vc-btn vc-btn-teal"
                    style={{ justifyContent: 'center', padding: '12px' }}
                    onClick={analyzeBlood}
                    disabled={bloodLoading}
                  >
                    {bloodLoading ? 'Analysing markers…' : '🩸 Analyze Blood Data'}
                  </button>
                </div>

                <div className="l2-col">
                  {results.blood ? (
                    <L2ResultCard result={results.blood} />
                  ) : (
                    <div className="l2-res-card-empty">
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Awaiting Analysis</div>
                      <div style={{ fontSize: 13 }}>Enter blood marker values and click Analyze Blood Data.</div>
                    </div>
                  )}

                  <div className="l2-info-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text4)' }}>
                      <span>REFERENCE RANGES</span>
                      <span>Adult population</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--text4)', fontWeight: 700 }}>
                      <span>Marker</span><span>Normal</span><span>TB Typical</span>
                    </div>
                    {[
                      ['Hemoglobin', '12.0–17.5 g/dL', '< 11.5 g/dL'],
                      ['WBC Count',  '4.0–11.0 ×10³', '> 11.0 ×10³'],
                      ['ESR',        '< 20 mm/hr',    '> 40 mm/hr'],
                      ['CRP',        '< 10 mg/L',     '> 20 mg/L'],
                    ].map(([m, n, t]) => (
                      <div key={m} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 12.5, padding: '4px 0', color: 'var(--text2)' }}>
                        <span>{m}</span>
                        <span style={{ fontFamily: 'var(--mono)' }}>{n}</span>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════ MODULE 03 — LAB / GENEXPERT ══════════════════ */}
          {activeTab === 'lab' && (
            <>
              <div className="l2-panel-head">
                <div className="l2-mod-tag" style={{ color: 'var(--teal)' }}>— MODULE 03</div>
                <h2 className="l2-mod-title">GeneXpert Lab Input</h2>
                <p className="l2-mod-sub">
                  Enter GeneXpert MTB/RIF molecular test results — the WHO gold-standard rapid TB diagnostic.
                </p>
              </div>

              <div className="l2-grid">
                <div className="l2-col">
                  <div className="l2-info-box">
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>01 · GeneXpert MTB/RIF Result</div>
                    <div className="l2-opt-grid">
                      {GENEXPERT_OPTS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`l2-opt-btn ${genexpert === opt.value ? `active-${opt.color}` : ''}`}
                          onClick={() => { setGenexpert(opt.value); setModuleResult('lab', null); }}
                        >
                          <span style={{ fontSize: 18 }}>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="l2-info-box">
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>02 · Rifampicin Resistance</div>
                    <div className="l2-opt-grid">
                      {RIFAMPICIN_OPTS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`l2-opt-btn ${rifampicin === opt.value ? `active-${opt.color}` : ''}`}
                          onClick={() => { setRifampicin(opt.value); setModuleResult('lab', null); }}
                        >
                          <span style={{ fontSize: 18 }}>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {genexpert && rifampicin && (
                    <div className="l2-info-box">
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text4)' }}>SELECTED VALUES</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text3)' }}>GeneXpert MTB/RIF</span>
                        <strong style={{ color: genexpert === 'positive' ? 'var(--red)' : genexpert === 'negative' ? 'var(--teal)' : 'var(--amber)' }}>
                          {genexpert.toUpperCase()}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text3)' }}>Rifampicin Resistance</span>
                        <strong style={{ color: rifampicin === 'yes' ? 'var(--red)' : rifampicin === 'no' ? 'var(--teal)' : 'var(--amber)' }}>
                          {rifampicin.toUpperCase()}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="vc-btn vc-btn-teal"
                      style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                      onClick={analyzeLab}
                      disabled={labLoading || !genexpert || !rifampicin}
                    >
                      {labLoading ? 'Processing…' : '🧬 Interpret Lab Result'}
                    </button>
                    <button
                      type="button"
                      className="vc-btn vc-btn-ghost"
                      onClick={() => { setGenexpert(''); setRifampicin(''); setModuleResult('lab', null); }}
                      title="Clear selection"
                    >
                      <i className="bi-x-lg" />
                    </button>
                  </div>
                </div>

                <div className="l2-col">
                  {results.lab ? (
                    <L2ResultCard result={results.lab} />
                  ) : (
                    <div className="l2-res-card-empty">
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🧪</div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Awaiting Input</div>
                      <div style={{ fontSize: 13 }}>Select GeneXpert and Rifampicin values, then click Interpret Lab Result.</div>
                    </div>
                  )}

                  <div className="l2-info-box">
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text4)' }}>ABOUT GENEXPERT</div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      Xpert MTB/RIF is an automated real-time PCR assay detecting <em>Mycobacterium tuberculosis</em> and
                      rifampicin resistance in under 2 hours, endorsed by WHO as the primary rapid molecular diagnostic.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[['≥88%', 'Sensitivity'], ['≥98%', 'Specificity'], ['~2hr', 'Turnaround']].map(([val, lbl]) => (
                        <div key={lbl} style={{ padding: 10, borderRadius: 8, background: 'var(--bg3)', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--teal)' }}>{val}</div>
                          <div style={{ fontSize: 11, color: 'var(--text4)' }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════ MODULE 04 — FINAL REPORT ══════════════════ */}
          {activeTab === 'final' && (
            <>
              <div className="l2-panel-head">
                <div className="l2-mod-tag" style={{ color: 'var(--teal)' }}>— MODULE 04 · LUNGLENS L2</div>
                <h2 className="l2-mod-title">Final Diagnosis Report</h2>
                <p className="l2-mod-sub">
                  Evidence-weighted fusion across completed modules. GeneXpert carries highest weight (50%), followed by X-ray (30%) and Blood (20%).
                </p>
              </div>

              {/* 3 Module Status Cards */}
              <div className="l2-mod-strip">
                {[
                  { id: 'xray' as TabKey,  label: 'Chest X-ray',  icon: '🫁', res: results.xray,  hasProb: true },
                  { id: 'blood' as TabKey, label: 'Blood Test',   icon: '🩸', res: results.blood, hasProb: true },
                  { id: 'lab' as TabKey,   label: 'GeneXpert Lab',icon: '🧬', res: results.lab,   hasProb: false },
                ].map(m => {
                  const done = !!m.res;
                  const pos = done && m.res?.tb_positive === true;
                  const neg = done && m.res?.tb_positive === false;
                  return (
                    <div key={m.id} className="l2-info-box" style={{ opacity: done ? 1 : 0.72, cursor: 'pointer' }} onClick={() => setActiveTab(m.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{m.icon} {m.label}</span>
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: pos ? 'rgba(239,68,68,0.15)' : neg ? 'rgba(0,232,181,0.15)' : 'var(--bg3)',
                          color: pos ? 'var(--red)' : neg ? 'var(--teal)' : 'var(--text4)',
                        }}>
                          {done ? (pos ? 'POSITIVE' : neg ? 'NEGATIVE' : 'INDETERMINATE') : 'NOT RUN'}
                        </span>
                      </div>
                      {done && m.hasProb && m.res?.probability != null && (
                        <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                          TB Probability: <strong>{m.res.probability.toFixed(1)}%</strong>
                        </div>
                      )}
                      {done && !m.hasProb && (
                        <div style={{ fontSize: 12, color: 'var(--text4)' }}>Molecular PCR confirmation recorded</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="vc-btn vc-btn-teal"
                  style={{ flex: 1, minWidth: 220, justifyContent: 'center', padding: '12px 18px' }}
                  onClick={analyzeFinal}
                  disabled={finalLoading || !hasAny}
                >
                  {finalLoading ? 'Generating Fusion Report…' : '📋 Generate Final Report'}
                </button>
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  onClick={downloadPDF}
                  disabled={pdfLoading || !results.final}
                >
                  {pdfLoading ? 'Preparing PDF…' : '⬇ Download PDF'}
                </button>
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  style={{ borderColor: savedPdfName ? 'var(--teal)' : undefined, color: savedPdfName ? 'var(--teal)' : undefined }}
                  onClick={saveReportToPatientRecord}
                  disabled={savingRecord || !results.final}
                >
                  {savingRecord ? 'Saving to Record…' : savedPdfName ? '✓ Saved to Record' : '☁ Save PDF to My Record'}
                </button>
              </div>

              {!hasAny && (
                <div className="dash-disclaimer">
                  <i className="bi-info-circle-fill" />
                  <div>Complete at least one test (Chest X-ray, Blood Test, or GeneXpert Lab) above before generating the final report.</div>
                </div>
              )}

              {results.final && (
                <div className="l2-report-sheet" ref={reportRef}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #1e3050', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28 }}>🏥</span>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>LungLens</div>
                        <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>TB Detection System · Level 2</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, fontFamily: 'var(--mono)' }}>
                      <div className="muted">Report Date: {reportDate}</div>
                      <div className="muted">Weighted Fusion v1.0</div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px',
                    background: results.final.tb_positive ? 'rgba(255,75,110,0.08)' : 'rgba(0,230,118,0.08)',
                    borderBottom: '1px solid #1e3050',
                  }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: results.final.tb_positive ? '#ff4b6e' : '#00e676' }}>
                        {results.final.tb_positive ? '⚠ TB POSITIVE' : '✓ TB NEGATIVE'}
                      </div>
                      <div className="muted" style={{ fontSize: 12, fontFamily: 'var(--mono)', marginTop: 4 }}>Fused Clinical Determination</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--mono)' }}>
                        {results.final.probability?.toFixed(1)}%
                      </div>
                      <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>TB Probability</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #1e3050', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 6 }}>MODEL CONFIDENCE</div>
                      <div style={{ height: 7, background: '#141f2e', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(results.final.confidence || 0, 100)}%`,
                          background: results.final.tb_positive ? '#ff4b6e' : '#00e676',
                        }} />
                      </div>
                      <div style={{ fontSize: 12.5, fontFamily: 'var(--mono)', marginTop: 4 }}>{results.final.confidence?.toFixed(1)}%</div>
                    </div>
                    {results.final.risk_level && (
                      <div style={{ textAlign: 'right' }}>
                        <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 4 }}>RISK LEVEL</div>
                        <span style={{
                          padding: '4px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                          background: results.final.risk_level === 'HIGH' ? 'rgba(255,75,110,0.16)' : 'rgba(0,230,118,0.14)',
                          color: results.final.risk_level === 'HIGH' ? '#ff4b6e' : '#00e676',
                        }}>
                          {results.final.risk_level}
                        </span>
                      </div>
                    )}
                  </div>

                  {results.final.recommendation && (
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e3050' }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#00d4ff', marginBottom: 6 }}>CLINICAL RECOMMENDATION</div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>{results.final.recommendation}</div>
                    </div>
                  )}

                  {results.final.contributing_factors && results.final.contributing_factors.length > 0 && (
                    <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e3050' }}>
                      <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 10 }}>CONTRIBUTING DIAGNOSTIC TESTS</div>
                      <div style={{ border: '1px solid #1e3050', borderRadius: 8, overflow: 'hidden' }}>
                        {results.final.contributing_factors.map((f, idx) => (
                          <div key={idx} style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 14px',
                            borderTop: idx > 0 ? '1px solid #1e3050' : 'none', fontSize: 13,
                          }}>
                            <span>{f.test}</span>
                            <span style={{ fontFamily: 'var(--mono)' }}>{f.result}</span>
                            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right' }}>{f.contribution}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 11.5 }} className="muted">
                    <span>Generated by LungLens · AI TB Detection System</span>
                    <span>{reportDate}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}
