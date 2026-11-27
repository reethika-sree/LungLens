import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import ResultCard from '../components/ResultCard.jsx'
import styles from './FinalResultPage.module.css'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const API = '/predict/final'

export default function FinalResultPage({ results, onResult }) {
  const [loading, setLoading]         = useState(false)
  const [pdfLoading, setPdfLoading]   = useState(false)
  const [pdfSuccess, setPdfSuccess]   = useState(false)
  const reportRef = useRef(null)
  const finalResult = results.final
  const { xray, blood, lab } = results
  const hasAny = xray || blood || lab

  /* ── Generate final report ───────────────────────────────────────────── */
  const analyze = async () => {
    if (!hasAny) {
      toast.error('Complete at least one diagnostic test first.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        xray_prob:  xray  ? xray.probability  : null,
        blood_prob: blood ? blood.probability : null,
        lab_result: lab   ? lab.tb_positive   : null,
      }
      const { data } = await axios.post(API, payload)
      onResult(data)
      toast.success('Final analysis complete!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Final analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Download PDF ────────────────────────────────────────────────────── */
  const generatePDF = async () => {
    if (!finalResult) {
      toast.error('Please generate the final report first.')
      return
    }
    setPdfLoading(true)
    setPdfSuccess(false)
    try {
      const element = reportRef.current
      if (!element) { toast.error('Report not found.'); return }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#080d14',
      })

      const imgData   = canvas.toDataURL('image/png')
      const pdf       = new jsPDF('p', 'mm', 'a4')
      const imgWidth  = 210
      const pageH     = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft  = imgHeight
      let position    = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageH
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageH
      }

      const ts  = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
      pdf.save(`LungLens_TB_Report_${ts}.pdf`)
      setPdfSuccess(true)
      toast.success('Report downloaded!')
      setTimeout(() => setPdfSuccess(false), 3000)
    } catch (err) {
      console.error(err)
      toast.error('PDF generation failed. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  /* ── Module rows ─────────────────────────────────────────────────────── */
  const modules = [
    { id: 'xray',  label: 'Chest X-ray',  icon: '🫁', model: 'DenseNet121', result: xray,  probKey: 'probability' },
    { id: 'blood', label: 'Blood Test',    icon: '🩸', model: 'XGBoost',     result: blood, probKey: 'probability' },
    { id: 'lab',   label: 'GeneXpert Lab', icon: '🧬', model: 'Rule-Based',  result: lab,   probKey: null },
  ]

  const reportDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={styles.page}>

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerBadge}>TB DETECTION SYSTEM · L2</div>
          <h2 className={styles.title}>Final Diagnosis Report</h2>
          <p className={styles.subtitle}>
            Evidence-weighted AI fusion across all available diagnostic modules.
            GeneXpert carries highest weight (50%), followed by X-ray (30%) and Blood (20%).
          </p>
        </div>
        <div className={styles.fusionBadge}>
          <span className={styles.fusionIcon}>⚡</span>
          <div>
            <div className={styles.fusionLabel}>Fusion Engine</div>
            <div className={styles.fusionName}>Weighted Avg</div>
          </div>
        </div>
      </div>

      {/* ── Module status strip ───────────────────────────────────────── */}
      <div className={styles.moduleStrip}>
        {modules.map(m => {
          const done = !!m.result
          const pos  = done && m.result.tb_positive
          const neg  = done && m.result.tb_positive === false
          return (
            <div
              key={m.id}
              className={`${styles.moduleCard} ${
                pos ? styles.modulePos : neg ? styles.moduleNeg : done ? styles.moduleDone : styles.modulePending
              }`}
            >
              <div className={styles.moduleCardTop}>
                <span className={styles.moduleEmoji}>{m.icon}</span>
                <div className={styles.moduleCardInfo}>
                  <span className={styles.moduleCardLabel}>{m.label}</span>
                  <span className={styles.moduleCardModel}>{m.model}</span>
                </div>
                <span className={`${styles.moduleChip} ${
                  pos ? styles.chipPos : neg ? styles.chipNeg : styles.chipPending
                }`}>
                  {done ? (pos ? 'POSITIVE' : 'NEGATIVE') : 'NOT RUN'}
                </span>
              </div>
              {done && m.probKey && m.result[m.probKey] != null && (
                <div className={styles.probTrack}>
                  <div
                    className={`${styles.probFill} ${pos ? styles.fillRed : styles.fillGreen}`}
                    style={{ width: `${Math.min(m.result[m.probKey], 100)}%` }}
                  />
                  <span className={styles.probText}>{m.result[m.probKey].toFixed(1)}%</span>
                </div>
              )}
              {done && !m.probKey && (
                <div className={styles.labNote}>
                  GeneXpert · Rule-Based determination
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Fusion weight pills ───────────────────────────────────────── */}
      <div className={styles.weightRow}>
        <span className={styles.weightRowLabel}>FUSION WEIGHTS</span>
        {[['🧬 Lab', '50%', '#00b894'], ['🫁 X-ray', '30%', '#1a78ff'], ['🩸 Blood', '20%', '#ff6b9d']].map(([k, v, c]) => (
          <span key={k} className={styles.weightPill} style={{ '--pill-color': c }}>
            {k} <strong>{v}</strong>
          </span>
        ))}
        <span className={styles.weightNote}>renormalised for missing tests</span>
      </div>

      {/* ── Action buttons row ────────────────────────────────────────── */}
      <div className={styles.actionRow}>
        <button
          className={styles.generateBtn}
          onClick={analyze}
          disabled={loading || !hasAny}
        >
          {loading
            ? <><span className={styles.spinner} />Analysing…</>
            : <><span className={styles.btnIcon}>📋</span>Generate Final Report</>
          }
        </button>

        <button
          className={`${styles.downloadBtn} ${pdfSuccess ? styles.downloadSuccess : ''}`}
          onClick={generatePDF}
          disabled={pdfLoading || !finalResult}
          title={!finalResult ? 'Generate the report first' : 'Download PDF report'}
        >
          {pdfLoading ? (
            <><span className={styles.spinner} />Preparing PDF…</>
          ) : pdfSuccess ? (
            <><span className={styles.tickIcon}>✓</span>Downloaded!</>
          ) : (
            <>
              <span className={styles.dlIconWrap}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </span>
              Download PDF
            </>
          )}
        </button>
      </div>

      {!hasAny && (
        <div className={styles.warningBanner}>
          <span className={styles.warnIcon}>⚠️</span>
          Complete at least one test (X-ray, Blood, or Lab) before generating the final report.
        </div>
      )}

      {/* ── Final result report card ──────────────────────────────────── */}
      {finalResult && (
        <div className={styles.reportWrapper} ref={reportRef}>

          {/* Report header */}
          <div className={styles.reportHeader}>
            <div className={styles.reportHeaderLeft}>
              <div className={styles.reportLogo}>
                <span className={styles.reportLogoIcon}>🏥</span>
                <div>
                  <div className={styles.reportLogoTitle}>LungLens</div>
                  <div className={styles.reportLogoSub}>TB Detection System · Level 2</div>
                </div>
              </div>
            </div>
            <div className={styles.reportHeaderRight}>
              <div className={styles.reportMeta}>
                <span className={styles.reportMetaKey}>Report Date</span>
                <span className={styles.reportMetaVal}>{reportDate}</span>
              </div>
              <div className={styles.reportMeta}>
                <span className={styles.reportMetaKey}>AI Engine</span>
                <span className={styles.reportMetaVal}>Weighted Fusion v1.0</span>
              </div>
            </div>
          </div>

          <div className={styles.reportDivider} />

          {/* Verdict banner */}
          <div className={`${styles.verdictBanner} ${finalResult.tb_positive ? styles.verdictPos : styles.verdictNeg}`}>
            <div className={styles.verdictLeft}>
              <div className={`${styles.verdictPulse} ${finalResult.tb_positive ? styles.pulseDanger : styles.pulseSuccess}`} />
              <div>
                <div className={styles.verdictTitle}>
                  {finalResult.tb_positive ? '⚠ TB POSITIVE' : '✓ TB NEGATIVE'}
                </div>
                <div className={styles.verdictSub}>Fused AI Determination</div>
              </div>
            </div>
            <div className={styles.verdictRight}>
              <div className={styles.verdictProb}>
                <span className={styles.verdictProbNum}>{finalResult.probability?.toFixed(1)}</span>
                <span className={styles.verdictProbUnit}>%</span>
              </div>
              <div className={styles.verdictProbLabel}>TB Probability</div>
            </div>
          </div>

          {/* Confidence + Risk row */}
          <div className={styles.metricsRow}>
            <div className={styles.metricBox}>
              <span className={styles.metricLabel}>Model Confidence</span>
              <div className={styles.metricBarTrack}>
                <div
                  className={`${styles.metricBarFill} ${finalResult.tb_positive ? styles.metricRed : styles.metricGreen}`}
                  style={{ width: `${Math.min(finalResult.confidence, 100)}%` }}
                />
              </div>
              <span className={styles.metricValue}>{finalResult.confidence?.toFixed(1)}%</span>
            </div>

            {finalResult.risk_level && (
              <div className={styles.riskBox}>
                <span className={styles.metricLabel}>Risk Level</span>
                <span className={`${styles.riskBadge} ${styles['risk' + finalResult.risk_level]}`}>
                  {finalResult.risk_level}
                </span>
              </div>
            )}
          </div>

          {/* Message */}
          {finalResult.message && (
            <div className={styles.messageBox}>
              <span className={styles.messageIcon}>💬</span>
              <p className={styles.messageText}>{finalResult.message}</p>
            </div>
          )}

          {/* Recommendation */}
          {finalResult.recommendation && (
            <div className={styles.recommendationBox}>
              <div className={styles.recHeader}>
                <span className={styles.recIcon}>🩺</span>
                <span className={styles.recTitle}>Clinical Recommendation</span>
              </div>
              <p className={styles.recBody}>{finalResult.recommendation}</p>
            </div>
          )}

          {/* Contributing factors */}
          {finalResult.contributing_factors?.length > 0 && (
            <div className={styles.factorsBox}>
              <div className={styles.factorsTitle}>
                <span>📊</span> Contributing Diagnostic Tests
              </div>
              <div className={styles.factorsTable}>
                <div className={styles.factorsHead}>
                  <span>Module</span><span>Result</span><span>Weight</span>
                </div>
                {finalResult.contributing_factors.map((f, i) => (
                  <div key={i} className={styles.factorsRow}>
                    <span className={styles.factorTest}>{f.test}</span>
                    <span className={`${styles.factorResult} ${
                      f.result?.toLowerCase().includes('positive') ? styles.factorPos : styles.factorNeg
                    }`}>{f.result}</span>
                    <span className={styles.factorWeight}>{f.contribution}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className={styles.disclaimer}>
            <span className={styles.disclaimerIcon}>⚕️</span>
            <p>
              <strong>Medical Disclaimer:</strong> This AI report is a clinical decision-support tool only.
              Final diagnosis and treatment must be confirmed by a licensed medical professional in accordance
              with NTEP / WHO guidelines. This system cannot prescribe medication.
            </p>
          </div>

          {/* Report footer */}
          <div className={styles.reportFooter}>
            <span>Generated by LungLens · AI TB Detection System</span>
            <span>{reportDate}</span>
          </div>
        </div>
      )}
    </div>
  )
}
