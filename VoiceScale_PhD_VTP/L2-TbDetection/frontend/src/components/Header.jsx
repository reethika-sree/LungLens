import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <div className={styles.logoInner} />
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>Voice<span className={styles.accent}>Care</span> PHC</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.statusBadge}>
          <span className={styles.statusDot} />
          System Online
        </div>
      </div>
    </header>
  )
}
