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

      {/* Floating geometric shapes */}
      <div className="hero-shape hero-shape-1"></div>
      <div className="hero-shape hero-shape-2"></div>
      <div className="hero-shape hero-shape-3"></div>

      {/* Content */}
      <div className="hero-content animate-fade-in">
          <span className="badge">
            Gregorious Creative Studios
          </span>
          <h1 className="hero-title">
            Transform your <br/> <span className="gradient-text">digital workflow.</span>
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

          {/* Trust badges */}
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-dot"></span>
              15+ Tools
            </div>
            <div className="hero-stat">
              <span className="hero-stat-dot"></span>
              100% Private
            </div>
            <div className="hero-stat">
              <span className="hero-stat-dot"></span>
              No Sign-up
            </div>
          </div>
      </div>
    </section>
  );
};

export default Hero;