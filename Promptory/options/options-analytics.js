// Promptory Options Page — Mixpanel Analytics Init
// Extracted from inline script for CSP compliance (script-src 'self')
if (typeof mixpanel !== 'undefined') {
  mixpanel.init('c86143cd74824a2d516134f860745000', {
    debug: false,
    track_pageview: false,
    persistence: 'localStorage',
    api_host: 'https://api-js.mixpanel.com'
  });
  mixpanel.track('Page View', {
    page_url: 'chrome-extension://options',
    page_title: 'Promptory Options',
    page_name: 'Options'
  });
}
