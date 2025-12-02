/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { BRAND_NAME } from '../constants';

interface NavbarProps {
  onNavClick: (e: React.MouseEvent<HTMLElement>, targetId: string) => void;
  currentView: string;
}

const Navbar: React.FC<NavbarProps> = ({ onNavClick, currentView }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const isLightBackground = currentView === 'dashboard' || currentView === 'tool' || scrolled;

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