import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.css';
// After theme.css on purpose: dashboard.css builds on the .eb-* vocabulary and
// token set defined there, and relies on source order for a few overrides.
import './dashboard.css';
// The .u-* primitive layer. Last, so a primitive can override an inherited
// .eb-* rule on a screen that has been migrated but still sits inside the old
// shell markup.
import './ui/ui.css';
// The .bl-* / .bc-* intelligence layer: the three-layer reading and the charts.
// After ui.css because it composes those primitives; before the shell because
// the shell still needs the last word on page chrome.
import './ui/layers.css';
// Shell last: it composes the primitives and needs to win on the few rules
// where the old .eb-* chrome and the new .s-* chrome describe the same box.
import './shell/shell.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
