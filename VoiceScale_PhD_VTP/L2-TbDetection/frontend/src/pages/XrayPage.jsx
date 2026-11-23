import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import axios from 'axios'
import ResultCard from '../components/ResultCard.jsx'
import styles from './XrayPage.module.css'

const API = '/predict/xray'

const FINDINGS = [
  { icon: '◈', text: 'Pulmonary infiltrates & consolidation' },
  { icon: '◈', text: 'Upper lobe opacities (classic TB pattern)' },
  { icon: '◈', text: 'Cavitary lesions' },
  { icon: '◈', text: 'Hilar lymphadenopathy' },
  { icon: '◈', text: 'Pleural effusion' },
]

export default function XrayPage({ onResult, result }) {
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const onDrop = useCallback((accepted) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    onResult(null)
  }, [onResult])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  })

  const analyze = async () => {
    if (!file) { toast.error('Please upload a chest X-ray image first.'); return }
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post(API, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onResult(data)
      toast.success('X-ray analysis complete!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed. Check API server.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setFile(null); setPreview(null); onResult(null) }

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.sectionTag}>MODULE 01</div>
          <h2 className={styles.title}>Chest X-ray Analysis</h2>
          <p className={styles.subtitle}>
            Upload a posteroanterior (PA) chest X-ray. Our DenseNet121 model detects
            TB-associated radiographic patterns with high sensitivity.
          </p>
        </div>
        <div className={styles.modelChip}>
          <div className={styles.modelChipDot} />
          <div>
            <div className={styles.modelChipLabel}>AI Model</div>
            <div className={styles.modelChipName}>DenseNet121</div>
          </div>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className={styles.grid}>

        {/* Left — Upload */}
        <div className={styles.uploadSection}>

          <div
            {...getRootProps()}
            className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''} ${file ? styles.hasFile : ''}`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <div className={styles.previewWrapper}>
                <img src={preview} alt="X-ray preview" className={styles.preview} />
                <div className={styles.previewOverlay}>
                  <span className={styles.previewOverlayText}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Drop to replace
                  </span>
                </div>
                {/* scan line animation */}
                <div className={styles.scanLine} />
              </div>
            ) : (
              <div className={styles.dropContent}>
                <div className={styles.dropIconRing}>
                  <span className={styles.dropIcon}>🫁</span>
                </div>
                <p className={styles.dropText}>
                  {isDragActive ? 'Release to upload…' : 'Drag & drop chest X-ray here'}
                </p>
                <p className={styles.dropSub}>JPG or PNG · max 20 MB</p>
                <div className={styles.dropBrowseBtn}>Browse files</div>
              </div>
            )}
          </div>

          {file && (
            <div className={styles.fileInfo}>
              <div className={styles.fileIconWrap}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.analyzeBtn} onClick={analyze} disabled={!file || loading}>
              {loading
                ? <><span className={styles.spinner} />Analyzing…</>
                : <><span className={styles.btnGlyph}>🔬</span>Analyze X-ray</>
              }
            </button>
            {file && (
              <button className={styles.resetBtn} onClick={reset} title="Clear">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Right — Results */}
        <div className={styles.resultSection}>
          {result ? (
            <ResultCard result={result} module="xray" />
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyGlyph}>📊</div>
              <p className={styles.emptyTitle}>Awaiting Analysis</p>
              <p className={styles.emptyText}>Upload an X-ray and click Analyze to see AI results.</p>
            </div>
          )}

          <div className={styles.infoPanel}>
            <div className={styles.infoPanelHeader}>
              <span className={styles.infoPanelTag}>DETECTION TARGETS</span>
              <span className={styles.infoPanelModel}>DenseNet121 · ImageNet pretrained</span>
            </div>
            <div className={styles.findingsList}>
              {FINDINGS.map((f, i) => (
                <div key={i} className={styles.findingRow} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className={styles.findingDot}>{f.icon}</span>
                  <span className={styles.findingText}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
