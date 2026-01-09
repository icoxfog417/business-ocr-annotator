import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import './index.css';
import App from './App.tsx';
import outputs from '../amplify_outputs.json';

// Configure Amplify with outputs from sandbox deployment
// Note: Run 'npx ampx sandbox' to generate real configuration
Amplify.configure(outputs);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
