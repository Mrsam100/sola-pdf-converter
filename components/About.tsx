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
      <div className="about-features">
        <div className="about-feature-card about-feature-light">
          <div className="about-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="32" height="32">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="badge">Security First</span>
          <h3 className="panel-title">Your data is yours.</h3>
          <p className="panel-desc">
            We employ industry-standard 256-bit SSL encryption for all file transfers. Files are processed in secure, ephemeral containers and deleted automatically after 60 minutes. Your documents never touch a permanent server.
          </p>
          <ul className="about-feature-list">
            <li>256-bit SSL encryption</li>
            <li>Client-side processing</li>
            <li>Auto-delete after 60 minutes</li>
          </ul>
        </div>

        <div className="about-feature-card about-feature-dark">
          <div className="about-feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="32" height="32">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <span className="badge">Efficiency</span>
          <h3 className="panel-title">Engineered for speed.</h3>
          <p className="panel-desc">
            Built by Gregorious Creative Studios, Sola utilizes serverless edge computing to handle heavy conversions like OCR and Video without slowing down your browser.
          </p>
          <ul className="about-feature-list">
            <li>Serverless edge computing</li>
            <li>Browser-native performance</li>
            <li>Zero wait, instant results</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default About;