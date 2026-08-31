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
// The cross-screen refinement layer. Genuinely last: it is the file that
// settles the decisions every screen has to agree on — the content box, the
// heading roles, table metrics, badge shape and the empty/error states — so
// it has to be able to override both the .eb-* chrome and the per-screen
// stylesheets Vite injects for each component.
import './ui/refine.css';
// The page header system. Genuinely last: refine.css normalises every h1,
// button and header on the page, and this file describes the one component
// that has to win inside its own box. Nothing in it is !important — it simply
// comes after.
import './ui/pageHeader.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
