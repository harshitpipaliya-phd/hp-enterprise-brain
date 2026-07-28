import '@testing-library/jest-dom';

// jsdom does not implement matchMedia — every component using useTheme
// needs this to render at all in tests. A real, minimal mock: reports
// "light" (matches: false) by default, same as most CI environments would
// have no OS dark-mode signal.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
