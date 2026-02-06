/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { BRAND_NAME } from '../constants';
import { useTheme } from '../hooks/useTheme';

interface NavbarProps {
  onNavClick: (e: React.MouseEvent<HTMLElement>, targetId: string) => void;
  currentView: string;
}

const Navbar: React.FC<NavbarProps> = ({ onNavClick, currentView }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavClick(e, targetId);
  };

  const isLightBackground = currentView === 'dashboard' || currentView === 'tool' || currentView === 'page' || scrolled;

  return (
    <>
      <nav className={`navbar ${isLightBackground ? 'scrolled' : ''}`}>
        <div className="nav-container">
          {/* Logo */}
          <a 
            href="#" 
            onClick={(e) => handleLinkClick(e, 'home')}
            className="logo"
          >
            <div className="logo-mark"></div>
            {BRAND_NAME}
          </a>
          
          {/* Center Links - Desktop */}
          <div className="nav-links">
            <a href="#dashboard" onClick={(e) => handleLinkClick(e, 'dashboard')} className="nav-link">All Tools</a>
            <a href="#about" onClick={(e) => handleLinkClick(e, 'about')} className="nav-link">Why Sola</a>
          </div>

          {/* Right Actions */}
          <div className="nav-actions">
             <button
                onClick={toggleTheme}
                className="theme-toggle"
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
             >
                {theme === 'light' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                )}
             </button>
             <button
                onClick={(e) => handleLinkClick(e, 'dashboard')}
                className="nav-btn"
             >
                Start Converting
             </button>
            
            {/* Mobile Menu Toggle */}
            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Menu"
            >
               {mobileMenuOpen ? (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                 </svg>
               )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div 
        className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      >
          <div 
             style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}
             onClick={(e) => e.stopPropagation()} // Prevent closing when clicking actual links container if preferred, but clicking links usually closes it anyway
          >
            <a href="#dashboard" onClick={(e) => handleLinkClick(e, 'dashboard')} className="mobile-nav-link">All Tools</a>
            <a href="#about" onClick={(e) => handleLinkClick(e, 'about')} className="mobile-nav-link">About</a>
            <button 
                onClick={(e) => handleLinkClick(e, 'dashboard')}
                className="btn-primary"
                style={{ marginTop: '1rem' }}
             >
                Start Converting
             </button>
          </div>
      </div>
    </>
  );
};

export default Navbar;