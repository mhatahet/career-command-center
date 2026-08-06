import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { AuthGate } from './lib/auth'
import { StoreProvider } from './lib/store'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    {/* AuthGate is a no-op unless Supabase is configured — see lib/auth.tsx.
        It sits outside StoreProvider so the store (and its first read of the
        data_files table, when Supabase is the active adapter) never mounts
        before a session exists. */}
    <AuthGate>
      <StoreProvider>
        <App />
      </StoreProvider>
    </AuthGate>
  </StrictMode>,
)
