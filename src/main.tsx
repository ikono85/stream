import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { LibraryProvider } from '@/hooks/library'
import '@/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </BrowserRouter>
  </StrictMode>,
)
