import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { SeasonProvider } from './SeasonContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SeasonProvider>
        <App />
      </SeasonProvider>
    </HashRouter>
  </StrictMode>,
);
