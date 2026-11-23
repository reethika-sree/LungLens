import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    id: 'xray',
    icon: '🫁',
    label: 'Chest X-ray',
    desc: 'Deep learning analysis',
    shortcut: '01',
  },
  {
    id: 'blood',
    icon: '🩸',
    label: 'Blood Test',
    desc: 'Biomarker analysis',
    shortcut: '02',
  },
  {
    id: 'lab',
    icon: '🧬',
    label: 'Lab / GeneXpert',
    desc: 'Molecular test results',
    shortcut: '03',
  },
  {
    id: 'final',
    icon: '📋',
    label: 'Final Report',
    desc: 'Fused AI decision',
    shortcut: '04',
    highlight: true,
  },
]

function ResultDot({ result }) {
  if (!result) return null
  const positive = result.tb_positive
  return (
    <span
      className={styles.resultDot}
      style={{ background: positive ? 'var(--danger)' : 'var(--success)' }}
      title={positive ? 'TB Positive' : 'TB Negative'}
    />
  )
}

export default function Sidebar({ activeTab, setActiveTab, results }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sectionLabel}>Diagnostic Modules</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''} ${item.highlight ? styles.highlight : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <div className={styles.navItemLeft}>
              <span className={styles.navIcon}>{item.icon}</span>
              <div className={styles.navText}>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.navDesc}>{item.desc}</span>
              </div>
            </div>
            <div className={styles.navItemRight}>
              <ResultDot result={results[item.id]} />
              <span className={styles.shortcut}>{item.shortcut}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className={styles.infoBox}>
        <div className={styles.infoTitle}>How to use</div>
        <ol className={styles.infoList}>
          <li>Run each test independently</li>
          <li>Combine in Final Report</li>
          <li>Share with your doctor</li>
        </ol>
      </div>
    </aside>
  )
}
