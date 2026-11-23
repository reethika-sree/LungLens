import styles from './ResultCard.module.css'

export default function ResultCard({ result, module }) {
  if (!result) return null

  const isPositive = result.tb_positive === true
  const isNegative = result.tb_positive === false
  const isUnknown  = result.tb_positive === null || result.tb_positive === undefined

  const statusClass = isPositive ? styles.positive
                    : isNegative ? styles.negative
                    : styles.unknown

  const statusText  = isPositive ? 'TB POSITIVE'
                    : isNegative ? 'TB NEGATIVE'
                    : 'INDETERMINATE'

  const statusIcon  = isPositive ? '⚠️' : isNegative ? '✓' : '?'

  return (
    <div className={`${styles.card} ${statusClass} fade-up`}>
      <div className={styles.header}>
        <div className={styles.statusBadge}>
          <span className={styles.statusIcon}>{statusIcon}</span>
          <span className={styles.statusText}>{statusText}</span>
        </div>
        <div className={styles.confidence}>
          <span className={styles.confidenceLabel}>Confidence</span>
          <span className={styles.confidenceValue}>{result.confidence?.toFixed(1)}%</span>
        </div>
      </div>

      {/* Confidence bar */}
      {result.confidence != null && (
        <div className={styles.barWrapper}>
          <div
            className={`${styles.bar} ${isPositive ? styles.barPositive : styles.barNegative}`}
            style={{ width: `${Math.min(result.confidence, 100)}%` }}
          />
        </div>
      )}

      {/* Risk level pill (fusion only) */}
      {result.risk_level && (
        <div className={styles.riskRow}>
          <span className={styles.riskLabel}>Risk Level</span>
          <span className={`${styles.riskPill} ${styles['risk' + result.risk_level]}`}>
            {result.risk_level}
          </span>
        </div>
      )}

      {/* Probability */}
      {result.probability != null && (
        <div className={styles.probRow}>
          <span className={styles.probLabel}>TB Probability</span>
          <span className={styles.probValue}>{result.probability?.toFixed(1)}%</span>
        </div>
      )}

      {/* Rifampicin resistance (lab only) */}
      {result.rifampicin_resistant != null && (
        <div className={styles.probRow}>
          <span className={styles.probLabel}>Rifampicin Resistance</span>
          <span className={styles.probValue} style={{ color: result.rifampicin_resistant ? 'var(--danger)' : 'var(--success)' }}>
            {result.rifampicin_resistant ? 'DETECTED' : 'Not Detected'}
          </span>
        </div>
      )}

      {/* Message */}
      {result.message && (
        <p className={styles.message}>{result.message}</p>
      )}

      {/* Recommendation (fusion only) */}
      {result.recommendation && (
        <div className={styles.recommendation}>
          <span className={styles.recLabel}>Recommendation</span>
          <p className={styles.recText}>{result.recommendation}</p>
        </div>
      )}

      {/* Contributing factors (fusion only) */}
      {result.contributing_factors?.length > 0 && (
        <div className={styles.factors}>
          <span className={styles.factorsLabel}>Contributing Tests</span>
          <div className={styles.factorsList}>
            {result.contributing_factors.map((f, i) => (
              <div key={i} className={styles.factorItem}>
                <span className={styles.factorTest}>{f.test}</span>
                <span className={styles.factorResult}>{f.result}</span>
                <span className={styles.factorWeight}>{f.contribution}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
