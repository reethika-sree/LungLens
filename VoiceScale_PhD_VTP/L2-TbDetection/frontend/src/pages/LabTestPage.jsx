import { useState } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import ResultCard from '../components/ResultCard.jsx'
import styles from './LabTestPage.module.css'

const API = '/predict/lab'

const GENEXPERT_OPTS = [
  { value: 'positive',      label: 'Positive',      icon: '⊕', color: 'danger' },
  { value: 'negative',      label: 'Negative',      icon: '⊖', color: 'success' },
  { value: 'indeterminate', label: 'Indeterminate', icon: '⊘', color: 'warning' },
]

const RIFAMPICIN_OPTS = [
  { value: 'yes',           label: 'Detected',      icon: '⊕', color: 'danger' },
  { value: 'no',            label: 'Not Detected',  icon: '⊖', color: 'success' },
  { value: 'indeterminate', label: 'Indeterminate', icon: '⊘', color: 'warning' },
]

const STATS = [
  { value: '≥88%', label: 'Sensitivity' },
  { value: '≥98%', label: 'Specificity' },
  { value: '~2hr', label: 'Time to Result' },
]

export default function LabTestPage({ onResult, result }) {
  const [genexpert, setGenexpert]   = useState('')
  const [rifampicin, setRifampicin] = useState('')
  const [loading, setLoading]       = useState(false)

  const analyze = async () => {
    if (!genexpert)  { toast.error('Please select a GeneXpert result.'); return }
    if (!rifampicin) { toast.error('Please select Rifampicin resistance status.'); return }
    setLoading(true)
    try {
      const { data } = await axios.post(API, {
        genexpert_result: genexpert,
        rifampicin_resistance: rifampicin,
      })
      onResult(data)
      toast.success('Lab result processed!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setGenexpert(''); setRifampicin(''); onResult(null) }

  const canAnalyze = genexpert && rifampicin

  const colorVar = (color) => `var(--${color})`

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.sectionTag}>MODULE 03</div>
          <h2 className={styles.title}>GeneXpert Lab Input</h2>
          <p className={styles.subtitle}>
            Enter GeneXpert MTB/RIF molecular test results — the WHO gold-standard
            rapid TB diagnostic with near-100% specificity.
          </p>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className={styles.grid}>

        {/* Left — Input */}
        <div className={styles.formSection}>

          {/* GeneXpert selector */}
          <div className={styles.selectorBlock}>
            <div className={styles.selectorHeader}>
              <div className={styles.selectorTitle}>
                <span className={styles.selectorNum}>01</span>
                GeneXpert MTB/RIF Result
              </div>
              <span className={styles.selectorNote}>WHO-endorsed rapid molecular test</span>
            </div>

            <div className={styles.optionGrid}>
              {GENEXPERT_OPTS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.optionBtn} ${genexpert === opt.value ? styles[`optActive_${opt.color}`] : ''}`}
                  onClick={() => { setGenexpert(opt.value); onResult(null) }}
                >
                  <span className={styles.optionIcon} style={genexpert === opt.value ? { color: colorVar(opt.color) } : {}}>
                    {opt.icon}
                  </span>
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {genexpert === opt.value && (
                    <span className={styles.optionCheck} style={{ color: colorVar(opt.color) }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Rifampicin selector */}
          <div className={styles.selectorBlock}>
            <div className={styles.selectorHeader}>
              <div className={styles.selectorTitle}>
                <span className={styles.selectorNum}>02</span>
                Rifampicin Resistance
              </div>
              <span className={styles.selectorNote}>Detected by GeneXpert RIF probe</span>
            </div>

            <div className={styles.optionGrid}>
              {RIFAMPICIN_OPTS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.optionBtn} ${rifampicin === opt.value ? styles[`optActive_${opt.color}`] : ''}`}
                  onClick={() => { setRifampicin(opt.value); onResult(null) }}
                >
                  <span className={styles.optionIcon} style={rifampicin === opt.value ? { color: colorVar(opt.color) } : {}}>
                    {opt.icon}
                  </span>
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {rifampicin === opt.value && (
                    <span className={styles.optionCheck} style={{ color: colorVar(opt.color) }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Summary preview */}
          {genexpert && rifampicin && (
            <div className={styles.summaryCard}>
              <div className={styles.summaryTitle}>SELECTED VALUES</div>
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryKey}>GeneXpert MTB/RIF</span>
                  <span className={`${styles.summaryVal} ${styles[genexpert === 'positive' ? 'valRed' : genexpert === 'negative' ? 'valGreen' : 'valAmber']}`}>
                    {genexpert.toUpperCase()}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryKey}>Rifampicin Resistance</span>
                  <span className={`${styles.summaryVal} ${styles[rifampicin === 'yes' ? 'valRed' : rifampicin === 'no' ? 'valGreen' : 'valAmber']}`}>
                    {rifampicin.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.analyzeBtn}
              onClick={analyze}
              disabled={loading || !canAnalyze}
            >
              {loading
                ? <><span className={styles.spinner} />Processing…</>
                : <><span className={styles.btnGlyph}>🧬</span>Interpret Lab Result</>
              }
            </button>
            <button className={styles.resetBtn} onClick={reset} title="Clear selection">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Right — Results + info */}
        <div className={styles.resultSection}>
          {result ? (
            <ResultCard result={result} module="lab" />
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyGlyph}>🧪</div>
              <p className={styles.emptyTitle}>Awaiting Input</p>
              <p className={styles.emptyText}>Select GeneXpert and Rifampicin values, then click Interpret.</p>
            </div>
          )}

          {/* About card */}
          <div className={styles.aboutCard}>
            <div className={styles.aboutHeader}>
              <span className={styles.aboutTag}>ABOUT GENEXPERT</span>
            </div>
            <p className={styles.aboutText}>
              Xpert MTB/RIF is an automated real-time PCR assay that simultaneously detects
              <em> Mycobacterium tuberculosis</em> and rifampicin resistance in under 2 hours.
              Endorsed by WHO as the primary initial test in high-burden settings.
            </p>
            <div className={styles.statsRow}>
              {STATS.map(s => (
                <div key={s.label} className={styles.statBox}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
