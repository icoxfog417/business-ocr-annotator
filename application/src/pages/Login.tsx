import { signInWithRedirect } from 'aws-amplify/auth';

export function Login() {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#ffffff',
      }}
    >
      {/* Left side - Branding */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '4rem',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        }}
      >
        <div style={{ maxWidth: '520px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 7h10" />
                <path d="M7 12h10" />
                <path d="M7 17h7" />
              </svg>
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: '600', color: '#0f172a' }}>
              Business OCR Annotator
            </span>
          </div>

          <h1
            style={{
              fontSize: '3rem',
              fontWeight: '700',
              lineHeight: '1.2',
              marginBottom: '1.5rem',
              color: '#0f172a',
            }}
          >
            Build VQA Datasets for Business Documents
          </h1>

          <p
            style={{
              fontSize: '1.25rem',
              color: '#64748b',
              lineHeight: '1.8',
              marginBottom: '3rem',
            }}
          >
            Crowdsourced annotation platform for creating high-quality Visual Question Answering
            datasets. Help evaluate OCR accuracy of AI models.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#3b82f6',
                  borderRadius: '50%',
                }}
              />
              <span style={{ color: '#475569' }}>AI-assisted text extraction with Amazon Bedrock</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#3b82f6',
                  borderRadius: '50%',
                }}
              />
              <span style={{ color: '#475569' }}>Multi-language support (Japanese, English, Chinese, Korean)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  background: '#3b82f6',
                  borderRadius: '50%',
                }}
              />
              <span style={{ color: '#475569' }}>Mobile-friendly with camera capture</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div
        style={{
          width: '480px',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 3rem',
          borderLeft: '1px solid #e5e7eb',
        }}
      >
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <h2
            style={{
              fontSize: '1.875rem',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '0.5rem',
            }}
          >
            Welcome back
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>
            Sign in to your account to continue
          </p>

          <button
            onClick={handleGoogleSignIn}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '16px 24px',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '0.9375rem',
              fontWeight: '600',
              color: '#1e293b',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z"
                fill="#4285F4"
              />
              <path
                d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z"
                fill="#34A853"
              />
              <path
                d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z"
                fill="#FBBC05"
              />
              <path
                d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <p
            style={{
              marginTop: '2.5rem',
              fontSize: '0.8125rem',
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: '1.6',
            }}
          >
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
