import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes/router'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
const root = document.getElementById('root')!
createRoot(root).render(
  <QueryClientProvider client={qc}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)
