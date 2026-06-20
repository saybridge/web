import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { injectTokens } from '@saybridge/ui'
import './index.css'
import App from './App.tsx'
import './i18n';

// Inject saybridge-ui-kit tokens and styles dynamically
injectTokens();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
