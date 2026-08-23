import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ScenarioProvider } from './app/scenario';
import './design-system/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScenarioProvider>
      <App />
    </ScenarioProvider>
  </StrictMode>,
);
