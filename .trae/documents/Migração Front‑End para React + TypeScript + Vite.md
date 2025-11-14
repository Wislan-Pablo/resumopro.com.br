## Diagnóstico Atual
- Módulos ES em `static/js/editor/*` com fluxo central em `main.js`; forte manipulação imperativa do DOM, uso pontual de `jQuery`.
- Autenticação em `auth.js` com endpoints `/auth/*` e checagem `/me`; controle de visibilidade de botões e modal.
- Galeria distribuída em `gallery.js` e `modal.js`: modos `pdf/captures/uploads`, cópia/remoção, drag & drop, contadores e estados vazios; uploads em `/api/uploads/*`.
- Editor em `jodit.js` com colagem de capturas e debounce de salvar; dados em `data.js` com múltiplos fallbacks.
- Visualização PDF em `tabs.js`, `adobe-sdk.js`, `pdf-source.js` com boot do Adobe View SDK e seleção de PDFs locais/GCS.
- Estado global único em `state.js` com setters; exemplo de fragilidade: recriação de botões (`btnUploadPdf.replaceWith(clone)`) para reanexar handlers.

## Objetivos de Arquitetura
- SPA com `React + TypeScript + Vite` e roteamento por `React Router`.
- Estado previsível com `Zustand`; data fetching/cache com `TanStack Query`.
- Padronização de estilos com `Tailwind CSS` ou `CSS Modules`.
- Virtualização da galeria com `react-window`.
- Wrappers: `jodit-react` e integração Adobe Viewer controlada por `useEffect`.
- Qualidade: `Vitest` + `Testing Library` e E2E em `Playwright`.
- Integração CI/CD com Cloud Build, servindo `dist/` via backend atual em Cloud Run.

## Estrutura de Projeto (SPA)
- `frontend/`
  - `index.html`
  - `src/`
    - `main.tsx`
    - `App.tsx`
    - `routes/` (`router.tsx`, páginas)
    - `components/` (`AuthModal`, `Header`, `Sidebar`, `Gallery`, `GalleryItem`, `UploadModal`, `PdfViewer`, `Editor`)
    - `state/` (`auth.store.ts`, `editor.store.ts`, `gallery.store.ts`)
    - `services/` (`api-client.ts`, `adobe-sdk.ts`, `jodit.ts`)
    - `hooks/` (`useAdobeViewer.ts`, `useUploads.ts`, `useGallery.ts`)
    - `utils/` (sanitização HTML, i18n, debounce)
    - `types/` (tipos para Editor/Galeria/Auth)
  - `tests/` (unitários e integração)
  - `e2e/` (fluxos principais)
  - `vite.config.ts`
  - `tailwind.config.ts` (se aplicável)

## Fase 0 — Fundações
- Inicializar `Vite` com React + TS; configurar `VITE_API_BASE_URL` e `VITE_ADOBE_CLIENT_ID`.
- Criar `ApiClient` com `credentials: 'include'`, base URL e tratamento de `401`.
- Instalar `Zustand`, `@tanstack/react-query`, `react-router-dom`, `react-window`, `jodit-react`, `tailwindcss` ou configurar CSS Modules.
- Remover dependência de `jQuery` em novas partes; manter compat via adaptadores apenas durante transição.

### ApiClient (exemplo)
```ts
// src/services/api-client.ts
const base = import.meta.env.VITE_API_BASE_URL;
async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, { credentials: 'include', ...init });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
export const api = {
  get: (p: string) => request(p),
  post: (p: string, body: any) => request(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  upload: (p: string, form: FormData) => request(p, { method: 'POST', body: form })
};
```

### Providers
```ts
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes/router';
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
```

## Fase 1 — Autenticação e Layout
- `AuthModal` controlado por estado global (`auth.store.ts`) e rotas protegidas.
- `Zustand` mantém `user`, `isAuthenticated`, `login/logout`; `TanStack Query` consulta `/me` e invalida queries após `login/logout`.
- `Header` com botões Entrar/Sair; `Layout` com `Sidebar` e área principal.

### Estado de Auth
```ts
// src/state/auth.store.ts
import { create } from 'zustand';
type User = { id: string; email: string; name?: string } | null;
interface AuthState { user: User; setUser: (u: User) => void; logout: () => Promise<void>; }
export const useAuth = create<AuthState>((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  logout: async () => { await api.post('/auth/logout', {}); set({ user: null }); }
}));
```

### Consulta `/me`
```ts
// src/hooks/useMe.ts
import { useQuery } from '@tanstack/react-query';
export function useMe() { return useQuery({ queryKey: ['me'], queryFn: () => api.get('/me'), staleTime: 60000 }); }
```

## Fase 2 — Galeria
- Componentizar `Gallery` com modos e virtualização via `react-window`.
- `TanStack Query` para `uploads`, `captures` e `pdf-images`; mutações para copiar/excluir/upload com feedback consistente.
- `UploadModal` com drag & drop e progresso; lazy-loading de imagens.

### Virtualização
```tsx
// src/components/Gallery.tsx
import { FixedSizeGrid as Grid } from 'react-window';
export function Gallery({ items }: { items: { id: string; url: string }[] }) {
  const Cell = ({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * 4 + columnIndex; const it = items[index];
    return it ? <div style={style}><img src={it.url} loading="lazy" /></div> : <div style={style} />;
  };
  const rows = Math.ceil(items.length / 4);
  return <Grid columnCount={4} columnWidth={180} height={600} rowCount={rows} rowHeight={180} width={760}>{Cell as any}</Grid>;
}
```

## Fase 3 — Editor
- Substituir inicialização direta por `jodit-react` (`Editor` componente), controlando valor e eventos via props.
- Normalizar/sanitizar HTML inicial; centralizar contador/empty states e `setGalleryMode` no store.

### Editor
```tsx
// src/components/Editor.tsx
import JoditEditor from 'jodit-react';
export function Editor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <JoditEditor value={value} onChange={onChange} />;
}
```

## Fase 4 — PDF Viewer
- Componente `PdfViewer` carrega Adobe View SDK e instancia o viewer em `useEffect` com reset ao alternar PDFs.
- Estado `pdfLoadedForCapture` e `adobeView` migram para `editor.store.ts`.

### Adobe Viewer
```tsx
// src/components/PdfViewer.tsx
import { useEffect, useRef } from 'react';
export function PdfViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let view: any;
    (async () => {
      await loadAdobeSdk();
      view = new (window as any).AdobeDC.View({ clientId: import.meta.env.VITE_ADOBE_CLIENT_ID, divId: ref.current!.id });
      await view.previewFile({ content: { location: { url } }, metaData: { fileName: 'document.pdf' } });
    })();
    return () => { view?.close?.(); };
  }, [url]);
  return <div id="adobe-view" ref={ref} />;
}
```

## Fase 5 — Qualidade
- Unitários: stores, hooks e componentes principais; testes de renderização e interações.
- E2E: login, uploads, recaptura, salvar projeto, geração de PDF.
- Observabilidade: logger leve, toasts uniformes para `401/404/500`, métricas básicas de latência.

## Fase 6 — Refinos
- Remover handlers inline e recriações de elementos; garantir acessibilidade com `aria-*`.
- Internacionalização com i18n simples; ajustes finos de UX e desempenho.

## Mapa de Correspondência (Atual → Novo)
- `auth.js` → `AuthModal`, `useAuth`, `useMe`, `ProtectedRoute`.
- `gallery.js/modal.js` → `Gallery`, `GalleryItem`, `UploadModal`, `useGallery`, `useUploads`.
- `jodit.js/data.js` → `Editor`, `editor.store.ts`, `useEditorData`.
- `tabs.js/adobe-sdk.js/pdf-source.js/pdf.js` → `PdfViewer`, `usePdfSource`, `useAdobeViewer`, `useGeneratePdf`.
- `state.js` → `auth.store.ts`, `editor.store.ts`, `gallery.store.ts`.
- `utils.js` → `utils/*` e testes dedicados.

## Padrões de Erro e Auth
- Interceptação de `401`: invalidar `['me']`, limpar `auth.store`, abrir `AuthModal` e pausar mutações sensíveis.
- Padronização de erros: mapear `HTTP_404/500` para toasts e estados vazios nos componentes.
- Retentativas automáticas e revalidação com `TanStack Query`.

## Roteamento
- `React Router` para organizar Editor e PDF; fallback SPA para `index.html`.
- Rotas: `/editor`, `/pdf`, `/login` e âncoras de seleção de projeto.

## Build e Deploy (Cloud Build + Cloud Run)
- `cloudbuild.yaml`:
  - Passo Node: `npm ci && npm run build` em `frontend/`.
  - Copiar `frontend/dist/` para `static/` do contêiner.
  - Cache de dependências Node.
- Backend continua servindo `/api`; SPA servida por assets gerados pelo Vite.

## Estratégia de Migração (Incremental)
- Introduzir `frontend/` convivendo com `static/`; publicar `dist/` e passar a referenciar `index.html` novo.
- Migrar por áreas:
  - Autenticação e Layout → Galeria → Editor → PDF Viewer.
- Manter adaptadores temporários para dados e eventos enquanto módulos antigos coexistem.
- Remover gradualmente lógica imperativa do DOM (ex.: substituição de elementos para reanexar listeners).

## Métricas de Sucesso
- Redução de erros `401/404/500` e padronização de toasts.
- Tempo de interação inicial e scroll em galeria medidos e melhorados via virtualização.
- Manutenibilidade: cobertura de testes e remoção de manipulações diretas de DOM.

## Riscos e Mitigações
- Integração Adobe SDK: isolar em componente e validar credenciais; fallback informativo.
- Jodit HTML: sanitização e testes de regressão; preservar atalhos e colagens.
- Convivência de dois front-ends: rotas e assets bem delimitados; monitoramento de duplicidade de handlers.

## Próximos Passos
- Confirmar Tailwind vs CSS Modules.
- Validar variáveis `VITE_API_BASE_URL` e `VITE_ADOBE_CLIENT_ID`.
- Aprovar a estrutura e ordem de migração para iniciar Fase 0.