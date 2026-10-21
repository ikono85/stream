import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Admin } from '@/admin/Admin'
import '@/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root est absent de admin.html')

createRoot(root).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
