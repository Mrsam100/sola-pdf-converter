/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';

const Features: React.FC = () => {
  return (
    <section className="features-section">
      {/* Feature Block 1 */}
      <div className="features-grid">
        <div className="feature-image-block" style={{ order: 2 }}>
           <img 
             src="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=1200" 
             alt="Natural Stone Texture" 
           />
        </div>
        <div className="feature-content-block light" style={{ order: 1 }}>
           <span className="feature-label">Our Philosophy</span>
           <h3 className="feature-title">
             Materials that age <br/> with grace.
           </h3>
           <p className="feature-text">
             We reject the disposable. Every Aura product is crafted from sandstone, unpolished aluminum, and organic fabrics that develop a unique patina over time.
           </p>
           <a href="#" className="link-secondary">Read about our materials</a>
        </div>
      </div>

      {/* Feature Block 2 */}
      <div className="features-grid">
        <div className="feature-content-block dark">
           <span className="feature-label">The Ecosystem</span>
           <h3 className="feature-title">
             Silence by default.
           </h3>
           <p className="feature-text">
             Our devices respect your attention. No blinking lights, no intrusive notifications. Just calm utility when you need it, and a beautiful object when you don't.
           </p>
        </div>
        <div className="feature-image-block">
           <img 
             src="https://images.pexels.com/photos/6801917/pexels-photo-6801917.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1" 
             alt="Woman sitting on wooden floor reading" 
             style={{ filter: 'brightness(0.9)' }}
           />
        </div>
      </div>
    </section>
  );
};

export default Features;