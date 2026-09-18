import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { LocaleProvider } from './i18n/LocaleContext';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>
);
