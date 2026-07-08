import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErreurConfiguration from './components/ErreurConfiguration.jsx'
import { supabaseConfigError } from './lib/supabase'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {supabaseConfigError
      ? <ErreurConfiguration message={supabaseConfigError} />
      : <App />}
  </StrictMode>,
)
