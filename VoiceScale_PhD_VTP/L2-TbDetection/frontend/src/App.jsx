import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import XrayPage from './pages/XrayPage.jsx'
import BloodTestPage from './pages/BloodTestPage.jsx'
import LabTestPage from './pages/LabTestPage.jsx'
import FinalResultPage from './pages/FinalResultPage.jsx'
import styles from './styles/App.module.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('xray')
  const [results, setResults] = useState({
    xray:  null,
    blood: null,
    lab:   null,
    final: null,
  })

  const updateResult = (module, data) =>
    setResults(prev => ({ ...prev, [module]: data }))

  const tabs = {
    xray:  <XrayPage    onResult={d => updateResult('xray', d)}  result={results.xray}  />,
    blood: <BloodTestPage onResult={d => updateResult('blood', d)} result={results.blood} />,
    lab:   <LabTestPage  onResult={d => updateResult('lab', d)}   result={results.lab}   />,
    final: <FinalResultPage results={results} onResult={d => updateResult('final', d)} />,
  }

  return (
    <div className={styles.app}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#141f2e',
            color: '#e8f0fa',
            border: '1px solid #1e3050',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.88rem',
          }
        }}
      />
      <Header />
      <div className={styles.layout}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} results={results} />
        <main className={styles.main}>
          <div key={activeTab} className="fade-up">
            {tabs[activeTab]}
          </div>
        </main>
      </div>
    </div>
  )
}
