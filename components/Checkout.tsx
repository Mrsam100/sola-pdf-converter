
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { Product } from '../types';

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ items, onBack }) => {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shipping = 0; // Free shipping
  const total = subtotal + shipping;

  return (
    <div className="checkout-page animate-fade-in">
      <div className="checkout-wrapper">
        <button 
          onClick={onBack}
          className="back-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Shop
        </button>

        <div className="checkout-grid">
          
          {/* Left Column: Form */}
          <div>
            <h1 className="checkout-title">Checkout</h1>
            <p className="checkout-subtitle">This is a sample site. Purchasing is disabled.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              {/* Section 1: Contact */}
              <div className="form-section">
                <h2>Contact Information</h2>
                <div className="input-group">
                   <input type="email" placeholder="Email address" className="form-input" disabled />
                   <div className="checkbox-group">
                     <input type="checkbox" id="newsletter" disabled style={{ accentColor: '#2C2A26' }} />
                     <label htmlFor="newsletter" className="checkbox-label">Email me with news and offers</label>
                   </div>
                </div>
              </div>

              {/* Section 2: Shipping */}
              <div className="form-section">
                <h2>Shipping Address</h2>
                <div className="input-group">
                   <div className="input-row">
                      <input type="text" placeholder="First name" className="form-input" disabled />
                      <input type="text" placeholder="Last name" className="form-input" disabled />
                   </div>
                   <input type="text" placeholder="Address" className="form-input" disabled />
                   <input type="text" placeholder="Apartment, suite, etc. (optional)" className="form-input" disabled />
                   <div className="input-row">
                      <input type="text" placeholder="City" className="form-input" disabled />
                      <input type="text" placeholder="Postal code" className="form-input" disabled />
                   </div>
                </div>
              </div>

               {/* Section 3: Payment (Mock) */}
              <div className="form-section">
                <h2>Payment</h2>
                <div className="payment-box">
                   <p className="checkbox-label">All transactions are secure and encrypted.</p>
                   <input type="text" placeholder="Card number" className="form-input" disabled />
                   <div className="input-row">
                      <input type="text" placeholder="Expiration (MM/YY)" className="form-input" disabled />
                      <input type="text" placeholder="Security code" className="form-input" disabled />
                   </div>
                </div>
              </div>

              <div>
                <button 
                    disabled
                    className="pay-btn"
                >
                    Pay Now — ${total}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Summary */}
          <div className="order-summary">
            <h2 className="checkout-title" style={{ fontSize: '1.25rem' }}>Order Summary</h2>
            
            <div className="summary-items">
               {items.map((item, idx) => (
                 <div key={idx} className="summary-item">
                    <div className="summary-img-box">
                       <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       <span className="qty-badge">1</span>
                    </div>
                    <div className="summary-details">
                       <h3 className="summary-name">{item.name}</h3>
                       <p className="summary-cat">{item.category}</p>
                    </div>
                    <span className="summary-price">${item.price}</span>
                 </div>
               ))}
            </div>

            <div className="cost-breakdown">
              <div className="cost-row">
                 <span>Subtotal</span>
                 <span>${subtotal}</span>
              </div>
              <div className="cost-row">
                 <span>Shipping</span>
                 <span>Free</span>
              </div>
            </div>
            
            <div className="total-row">
                 <span className="total-label">Total</span>
                 <div className="total-value-group">
                   <span className="currency-code">USD</span>
                   <span className="total-value">${total}</span>
                 </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;