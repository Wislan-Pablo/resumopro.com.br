export async function loadAdobeSdk() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (w.AdobeDC) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://documentcloud.adobe.com/view-sdk/main.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('ADOBE_SDK_LOAD_FAILED'))
    document.body.appendChild(s)
  })
}

export async function getAdobeClientId(): Promise<string | undefined> {
  const envId = import.meta.env.VITE_ADOBE_CLIENT_ID as string | undefined
  if (envId) return envId
  try {
    const res = await fetch('/api/config-viewer', { credentials: 'include' })
    if (!res.ok) return undefined
    const data = await res.json()
    return data?.clientId as string | undefined
  } catch {
    return undefined
  }
}
