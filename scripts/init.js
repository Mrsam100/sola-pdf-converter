/**
 * Initialization script for Sola PDF Converter
 * Moved from inline <script> tags to external file for CSP compliance
 * 
 * @license SPDX-License-Identifier: Apache-2.0
 */

// Service Worker registration for PWA support
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker not available, that's ok - app will work without it
      console.info('[Sola] Service worker registration skipped (not in HTTPS or not supported)');
    });
  });
}

// Offline/Online indicator management
window.addEventListener('online', () => {
  const indicator = document.getElementById('offline-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
});

window.addEventListener('offline', () => {
  const indicator = document.getElementById('offline-indicator');
  if (indicator) {
    indicator.style.display = 'block';
  }
});

// Security: Disable right-click context menu in production (optional)
// Uncomment if you want to prevent users from inspecting source easily
// document.addEventListener('contextmenu', (e) => {
//   if (window.location.hostname !== 'localhost') {
//     e.preventDefault();
//   }
// });

// Security: Detect and warn about browser DevTools being open
// (Advanced users can still bypass, but adds friction)
const devToolsCheck = () => {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  if (widthThreshold || heightThreshold) {
    // DevTools likely open - you could log this or show a warning
    console.warn('[Security] Browser DevTools detected. Please note that extracting API keys from client-side code is a security violation.');
  }
};

// Run devTools check every 1 second (can be disabled for production)
if (window.location.hostname !== 'localhost') {
  setInterval(devToolsCheck, 1000);
}
