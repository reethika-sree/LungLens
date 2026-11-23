import { useNavigate } from 'react-router-dom';
import './LandingPage.css'; // Reuse landing page styles

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 500, padding: '0 20px' }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          background: 'var(--red-a)', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <i className="bi-shield-exclamation" style={{ color: 'var(--red)', fontSize: 32 }} />
        </div>
        
        <h1 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 600, marginBottom: 10 }}>
          Access Denied
        </h1>
        
        <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.5, marginBottom: 30 }}>
          You don't have permission to access this portal. Please contact your administrator if you believe this is an error.
        </p>
        
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button 
            className="lp-btn-primary"
            onClick={() => navigate('/')}
            style={{ padding: '12px 24px' }}
          >
            <i className="bi-house" /> Go Home
          </button>
          <button 
            className="lp-btn-secondary"
            onClick={() => navigate('/login')}
            style={{ padding: '12px 24px' }}
          >
            <i className="bi-box-arrow-in-right" /> Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
