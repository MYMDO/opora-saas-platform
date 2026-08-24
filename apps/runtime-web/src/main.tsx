import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RuntimeApp from './RuntimeApp';
import './tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RuntimeApp />
  </StrictMode>,
);
