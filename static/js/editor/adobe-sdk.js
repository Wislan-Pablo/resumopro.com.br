let sdkPromise = null;

export function ensureAdobeSdkLoaded() {
  // Já carregado
  if (window.AdobeDC && window.AdobeDC.View) {
    return Promise.resolve();
  }

  // Promessa em andamento (local ou global)
  if (sdkPromise) return sdkPromise;
  if (window.__adobeSdkLoadingPromise) return window.__adobeSdkLoadingPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Falha ao carregar Adobe View SDK'));
    };
    const cleanup = () => {
      document.removeEventListener('adobe_dc_view_sdk.ready', onReady);
      document.removeEventListener('adobe_dc_view_sdk_ready', onReady);
    };

    // Ouvir os dois eventos conhecidos de ready
    document.addEventListener('adobe_dc_view_sdk.ready', onReady, { once: true });
    document.addEventListener('adobe_dc_view_sdk_ready', onReady, { once: true });

    // Se a tag já existir, apenas aguardar ready ou resolver imediatamente
    const existing = document.querySelector('script[src*="documentcloud.adobe.com/view-sdk/main.js"]');
    if (existing) {
      if (window.AdobeDC && window.AdobeDC.View) {
        cleanup();
        resolve();
      }
      return;
    }

    // Injetar script apenas se não existir
    const script = document.createElement('script');
    script.src = 'https://documentcloud.adobe.com/view-sdk/main.js';
    script.async = true;
    script.onload = () => {
      // Alguns ambientes não disparam o evento, então checar manualmente
      if (window.AdobeDC && window.AdobeDC.View) {
        cleanup();
        resolve();
      }
    };
    script.onerror = onError;
    script.setAttribute('data-adobe-sdk', 'true');
    document.head.appendChild(script);
  });

  window.__adobeSdkLoadingPromise = sdkPromise;
  return sdkPromise;
}