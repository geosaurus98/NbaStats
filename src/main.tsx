import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { FavouriteProvider } from './FavouriteContext';
import { SeasonProvider } from './SeasonContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SeasonProvider>
        <FavouriteProvider>
          <App />
        </FavouriteProvider>
      </SeasonProvider>
    </HashRouter>
  </StrictMode>,
);

// Installable/offline support when hosted (service workers need https; the
// double-click standalone file runs from file:// and skips this).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
