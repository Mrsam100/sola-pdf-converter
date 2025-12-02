/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface HeroProps {
    onExplore: () => void;
}

const Hero: React.FC<HeroProps> = ({ onExplore }) => {
  return (
    <section className="hero">
      
      {/* Background */}
      <div className="hero-bg"></div>
      
      {/* Texture Overlay */}
      <img 
        src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2000" 
        alt="Abstract Tech" 
        className="hero-texture"
      />

      {/* Content */}
      <div className="hero-content animate-fade-in">
          <span className="badge">
            Gregorious Creative Studios
          </span>
          <h1 className="hero-title">
            Transform your <br/> <span>digital workflow.</span>
          </h1>
          <p className="hero-subtitle">
            The all-in-one converter suite. Seamlessly transform PDFs, Images, Text, and Audio with privacy-first precision.
          </p>
          
          <div className="cta-group">
            <button 
                onClick={onExplore}
                className="btn-primary"
            >
                Explore Suite
            </button>
            <a href="#about" className="link-secondary">
                Learn More
            </a>
          </div>
      </div>
    </section>
  );
};

export default Hero;