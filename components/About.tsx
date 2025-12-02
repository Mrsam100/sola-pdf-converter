/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

const About: React.FC = () => {
  return (
    <section id="about" className="about-section">
      
      {/* Introduction */}
      <div className="about-intro">
        <div>
          <h2 className="about-title">
            Complexity, <br/> simplified.
          </h2>
        </div>
        <div style={{ maxWidth: '600px' }}>
          <p className="about-text">
            Sola was founded on a simple premise: digital friction costs time. Every incompatible file format, every locked PDF, and every pixelated image is a roadblock to creativity.
          </p>
          <p className="about-text">
            We built a suite of 55+ precision tools housed in a calm, distraction-free environment. No ads, no waiting, no complexity. Just the file you need, in the format you need it.
          </p>
          <div className="quote-box">
              <p>
                  "The ultimate sophistication is simplicity."
              </p>
          </div>
        </div>
      </div>

      {/* Philosophy Blocks */}
      <div className="split-panel">
        <div className="panel-image" style={{ order: 2 }}>
           <img 
             src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1200" 
             alt="Office Minimal" 
           />
           <div style={{ position: 'absolute', inset: 0, background: 'rgba(44, 42, 38, 0.1)' }}></div>
        </div>
        <div className="panel-content panel-light" style={{ order: 1 }}>
           <span className="badge">Security First</span>
           <h3 className="panel-title">
             Your data is yours.
           </h3>
           <p className="panel-desc">
             We employ industry-standard 256-bit SSL encryption for all file transfers. Files are processed in secure, ephemeral containers and deleted automatically after 60 minutes.
           </p>
        </div>
      </div>

      <div className="split-panel">
        <div className="panel-content panel-dark">
           <span className="badge" style={{ color: '#A8A29E' }}>Efficiency</span>
           <h3 className="panel-title">
             Engineered for speed.
           </h3>
           <p className="panel-desc">
             Built by Gregorious Creative Studios, Sola utilizes serverless edge computing to handle heavy conversions (like OCR and Video) without slowing down your browser.
           </p>
        </div>
        <div className="panel-image">
           <img 
             src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1200" 
             alt="Modern Architecture" 
             style={{ filter: 'grayscale(100%) brightness(0.9)' }}
           />
        </div>
      </div>
    </section>
  );
};

export default About;