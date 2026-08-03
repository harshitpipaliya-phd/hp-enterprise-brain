import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.css';
// After theme.css on purpose: dashboard.css builds on the .eb-* vocabulary and
// token set defined there, and relies on source order for a few overrides.
import './dashboard.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
