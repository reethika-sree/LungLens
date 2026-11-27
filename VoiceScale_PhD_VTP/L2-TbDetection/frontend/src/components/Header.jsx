import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <div className={styles.logoInner} />
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>Lung<span className={styles.accent}>Lens</span></span>
        </div>
      </div>
    </header>
  )
}
