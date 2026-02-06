/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import About from './components/About';
import Footer from './components/Footer';
import LegalPage from './components/LegalPage';
import { ViewState, PageId } from './types';
import { setupGlobalErrorHandling, logger, performanceMonitor } from './utils/monitoring';
import { MobileOptimized, LowBatteryWarning, SlowConnectionWarning } from './components/MobileOptimized';
import ToastContainer from './components/Toast';
import { usePreventZoom } from './hooks/useMobile';

function App() {
  const [view, setView] = useState<ViewState>({ type: 'home' });

  // Prevent accidental zoom on mobile
  usePreventZoom();

  // Initialize monitoring and error handling
  useEffect(() => {
    setupGlobalErrorHandling();
    logger.info('Application initialized', {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`
    });

    const timer = performanceMonitor.startTimer('app-session');

    return () => {
      timer();
      logger.info('Application unmounted');
    };
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    if (targetId === 'home') {
        setView({ type: 'home' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (targetId === 'dashboard') {
        setView({ type: 'dashboard' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        const element = document.getElementById(targetId);
        if (element) {
             element.scrollIntoView({ behavior: 'smooth' });
        }
    }
  };

  return (
    <MobileOptimized>
      <div>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Navbar
            onNavClick={handleNavClick}
            currentView={view.type}
        />

        <main id="main-content">
          {view.type === 'home' && (
            <>
              <Hero onExplore={() => setView({ type: 'dashboard' })} />
              <ProductGrid
                  onToolClick={(tool) => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      setView({ type: 'tool', tool: tool });
                  }}
              />
              <About />
            </>
          )}

          {view.type === 'dashboard' && (
              <div className="dashboard-view">
                   <ProductGrid
                      onToolClick={(tool) => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setView({ type: 'tool', tool: tool });
                      }}
                  />
              </div>
          )}

          {view.type === 'tool' && (
            <ProductDetail
              tool={view.tool}
              onBack={() => setView({ type: 'dashboard' })}
            />
          )}

          {view.type === 'page' && (
            <LegalPage
              pageId={view.pageId}
              onBack={() => { setView({ type: 'home' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
        </main>

        <Footer
          onLinkClick={handleNavClick}
          onPageClick={(pageId: PageId) => { setView({ type: 'page', pageId }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />

        {/* Mobile-specific warnings */}
        <LowBatteryWarning />
        <SlowConnectionWarning />

        {/* Toast notifications */}
        <ToastContainer />
      </div>
    </MobileOptimized>
  );
}

export default App;