/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { BRAND_NAME, STUDIO_NAME } from '../constants';

interface FooterProps {
  onLinkClick: (e: React.MouseEvent<HTMLElement>, targetId: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onLinkClick }) => {
  return (
    <footer className="footer">
      <div className="footer-grid">
        
        <div className="footer-brand">
          <h4>{BRAND_NAME}</h4>
          <p className="footer-desc">
            The professional standard for file conversion. 
            Fast, secure, and beautifully designed.
          </p>
          <div className="social-links">
             <div className="social-dot"></div>
             <div className="social-dot"></div>
             <div className="social-dot"></div>
          </div>
        </div>

        <div className="footer-col">
          <h4>Suite</h4>
          <ul className="footer-links">
            <li><a href="#dashboard" onClick={(e) => onLinkClick(e, 'dashboard')}>All Tools</a></li>
            <li><a href="#dashboard" onClick={(e) => onLinkClick(e, 'dashboard')}>PDF Converters</a></li>
            <li><a href="#dashboard" onClick={(e) => onLinkClick(e, 'dashboard')}>Image Tools</a></li>
            <li><a href="#dashboard" onClick={(e) => onLinkClick(e, 'dashboard')}>OCR & Text</a></li>
          </ul>
        </div>
        
        <div className="footer-col">
          <h4>Legal & Support</h4>
          <ul className="footer-links">
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact Support</a></li>
            <li><a href="#">API Access</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2025 {STUDIO_NAME}. All rights reserved.</p>
        <p>Designed in 2025</p>
      </div>
    </footer>
  );
};

export default Footer;