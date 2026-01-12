import { signInWithRedirect } from 'aws-amplify/auth';
import './Login.css';

export function Login() {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  return (
    <div className="login-container">
      {/* Left side - Branding (hidden on mobile) */}
      <div className="login-branding">
        <div className="login-branding-content">
          <div className="login-logo">
            <div className="login-logo-icon">
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
            <span className="login-logo-text">Business OCR Annotator</span>
          </div>

          <h1 className="login-title">Build VQA Datasets for Business Documents</h1>

          <p className="login-description">
            Crowdsourced annotation platform for creating high-quality Visual Question Answering
            datasets. Help evaluate OCR accuracy of AI models.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>AI-assisted text extraction with Amazon Bedrock</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Multi-language support (Japanese, English, Chinese, Korean)</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Mobile-friendly with camera capture</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="login-form-container">
        <div className="login-form">
          {/* Mobile logo (shown only on mobile) */}
          <div className="login-mobile-logo">
            <div className="login-logo-icon">
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
          </div>

          <h2 className="login-form-title">Welcome back</h2>
          <p className="login-form-subtitle">Sign in to your account to continue</p>

          <button onClick={handleGoogleSignIn} className="login-google-btn">
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

          <p className="login-terms">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
