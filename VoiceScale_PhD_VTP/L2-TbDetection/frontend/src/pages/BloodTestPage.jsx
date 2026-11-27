import { useState } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import ResultCard from '../components/ResultCard.jsx'
import styles from './BloodTestPage.module.css'

const API = '/predict/blood'

const FIELDS = [
  {
    key: 'hemoglobin',
    label: 'Hemoglobin',
    unit: 'g/dL',
    placeholder: '12.0 – 17.5',
    normal: '12.0 – 17.5',
    min: 1, max: 25, step: 0.1,
    icon: '🔴',
    info: 'Low Hb (anaemia) is common in TB patients due to chronic inflammation.',
    normalMin: 12.0, normalMax: 17.5,
  },
  {
    key: 'wbc_count',
    label: 'WBC Count',
    unit: '×10³/µL',
    placeholder: '4.0 – 11.0',
    normal: '4.0 – 11.0',
    min: 0.5, max: 50, step: 0.1,
    icon: '⚪',
    info: 'Elevated WBC (leukocytosis) signals infection or immune response.',
    normalMin: 4.0, normalMax: 11.0,
  },
  {
    key: 'esr',
    label: 'ESR',
    unit: 'mm/hr',
    placeholder: '0 – 20',
    normal: '< 20',
    min: 0, max: 150, step: 1,
    icon: '📉',
    info: 'Erythrocyte Sedimentation Rate — markedly elevated in active TB.',
    normalMin: 0, normalMax: 20,
  },
  {
    key: 'crp',
    label: 'CRP',
    unit: 'mg/L',
    placeholder: '0 – 10',
    normal: '< 10',
    min: 0, max: 300, step: 0.5,
    icon: '🔥',
    info: 'C-Reactive Protein — acute-phase marker elevated with TB infection.',
    normalMin: 0, normalMax: 10,
  },
]

const EMPTY = { hemoglobin: '', wbc_count: '', esr: '', crp: '' }

function getValueStatus(field, val) {
  const v = parseFloat(val)
  if (isNaN(v) || val === '') return 'empty'
  if (v < field.normalMin || v > field.normalMax) return 'abnormal'
  return 'normal'
}

export default function BloodTestPage({ onResult, result }) {
  const [values, setValues]   = useState(EMPTY)
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }))
  }

  const validate = () => {
    const errs = {}
    FIELDS.forEach(f => {
      const v = parseFloat(values[f.key])
      if (values[f.key] === '')   errs[f.key] = 'Required'
      else if (isNaN(v))          errs[f.key] = 'Must be a number'
      else if (v < f.min)         errs[f.key] = `Min ${f.min}`
      else if (v > f.max)         errs[f.key] = `Max ${f.max}`
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const analyze = async () => {
    if (!validate()) { toast.error('Please fill all fields correctly.'); return }
    setLoading(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, parseFloat(v)])
      )
      const { data } = await axios.post(API, payload)
      onResult(data)
      toast.success('Blood test analysis complete!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  const loadExample = (type) => {
    if (type === 'tb') {
      setValues({ hemoglobin: '9.8', wbc_count: '13.5', esr: '68', crp: '52' })
    } else {
      setValues({ hemoglobin: '14.2', wbc_count: '7.1', esr: '8', crp: '3' })
    }
    setErrors({})
    onResult(null)
  }

  const allFilled = FIELDS.every(f => values[f.key] !== '')

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.sectionTag}>MODULE 02</div>
          <h2 className={styles.title}>Blood Test Analysis</h2>
          <p className={styles.subtitle}>
            Enter CBC and inflammatory marker values to evaluate
            TB-associated haematological patterns with high accuracy.
          </p>
        </div>
      </div>

      {/* ── Example presets ──────────────────────────────────────────── */}
      <div className={styles.presetRow}>
        <span className={styles.presetLabel}>Quick fill:</span>
        <button className={styles.presetBtn} onClick={() => loadExample('normal')}>
          <span className={styles.presetDot} style={{ background: 'var(--success)' }} />
          Healthy Patient
        </button>
        <button className={`${styles.presetBtn} ${styles.presetDanger}`} onClick={() => loadExample('tb')}>
          <span className={styles.presetDot} style={{ background: 'var(--danger)' }} />
          TB Patient
        </button>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className={styles.grid}>

        {/* Left — Form */}
        <div className={styles.formSection}>
          <div className={styles.fields}>
            {FIELDS.map((f, i) => {
              const status = getValueStatus(f, values[f.key])
              return (
                <div
                  key={f.key}
                  className={`${styles.field} ${errors[f.key] ? styles.fieldErr : status === 'abnormal' ? styles.fieldAbnormal : status === 'normal' ? styles.fieldNormal : ''}`}
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <div className={styles.fieldTop}>
                    <div className={styles.fieldLeft}>
                      <span className={styles.fieldIcon}>{f.icon}</span>
                      <div>
                        <div className={styles.fieldLabel}>{f.label}</div>
                        <div className={styles.fieldUnit}>{f.unit}</div>
                      </div>
                    </div>
                    <div className={styles.fieldRight}>
                      <input
                        type="number"
                        className={styles.input}
                        value={values[f.key]}
                        onChange={e => handleChange(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                      />
                      {status === 'normal' && <span className={styles.statusNormal}>✓ Normal</span>}
                      {status === 'abnormal' && <span className={styles.statusAbnormal}>⚠ Abnormal</span>}
                    </div>
                  </div>

                  <div className={styles.fieldMeta}>
                    <span className={styles.normalRange}>Ref: {f.normal}</span>
                    <span className={styles.fieldInfoText}>{f.info}</span>
                  </div>

                  {errors[f.key] && (
                    <div className={styles.errMsg}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors[f.key]}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Completeness bar */}
          <div className={styles.progressWrap}>
            <div className={styles.progressLabel}>
              <span>Fields completed</span>
              <span>{FIELDS.filter(f => values[f.key] !== '').length} / {FIELDS.length}</span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${(FIELDS.filter(f => values[f.key] !== '').length / FIELDS.length) * 100}%` }}
              />
            </div>
          </div>

          <button className={styles.analyzeBtn} onClick={analyze} disabled={loading}>
            {loading
              ? <><span className={styles.spinner} />Analysing markers…</>
              : <><span className={styles.btnGlyph}>🩸</span>Analyze Blood Data</>
            }
          </button>
        </div>

        {/* Right — Results */}
        <div className={styles.resultSection}>
          {result ? (
            <ResultCard result={result} module="blood" />
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyGlyph}>🔬</div>
              <p className={styles.emptyTitle}>Awaiting Analysis</p>
              <p className={styles.emptyText}>Enter blood marker values and click Analyze to see AI results.</p>
            </div>
          )}

          {/* Reference table */}
          <div className={styles.refCard}>
            <div className={styles.refHeader}>
              <span className={styles.refTag}>REFERENCE RANGES</span>
              <span className={styles.refNote}>Adult population</span>
            </div>
            <div className={styles.refTable}>
              <div className={styles.refRow + ' ' + styles.refHead}>
                <span>Marker</span><span>Normal</span><span>TB Typical</span>
              </div>
              {[
                ['Hemoglobin', '12–17.5 g/dL', '↓ <11'],
                ['WBC Count',  '4–11 ×10³/µL', '↑ >11'],
                ['ESR',        '<20 mm/hr',     '↑ >40'],
                ['CRP',        '<10 mg/L',      '↑ >20'],
              ].map(([m, n, t]) => (
                <div key={m} className={styles.refRow}>
                  <span className={styles.refMarker}>{m}</span>
                  <span className={styles.refNormal}>{n}</span>
                  <span className={styles.refTb}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
