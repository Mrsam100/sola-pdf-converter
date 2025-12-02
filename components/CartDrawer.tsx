/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { Product } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: Product[];
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, items, onRemoveItem, onCheckout }) => {
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`drawer-backdrop ${isOpen ? 'visible' : 'hidden'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`drawer-panel ${isOpen ? 'open' : 'closed'}`}
      >
        {/* Header */}
        <div className="drawer-header">
          <h2 className="drawer-title">Your Cart ({items.length})</h2>
          <button 
            onClick={onClose} 
            className="drawer-close-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items List */}
        <div className="drawer-items">
          {items.length === 0 ? (
            <div className="empty-cart">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="icon-xl">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p>Your cart is empty.</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="cart-item animate-fade-in">
                <div className="cart-item-img-box">
                  <img src={item.imageUrl} alt={item.name} className="cart-item-img" />
                </div>
                <div className="cart-item-details">
                  <div>
                    <div className="cart-item-header">
                        <h3 className="cart-item-name">{item.name}</h3>
                        <span className="cart-item-price">${item.price}</span>
                    </div>
                    <p className="cart-item-cat">{item.category}</p>
                  </div>
                  <button 
                    onClick={() => onRemoveItem(idx)}
                    className="cart-remove-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <div className="cart-subtotal">
            <span className="subtotal-label">Subtotal</span>
            <span className="subtotal-value">${total}</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#A8A29E', marginBottom: '1.5rem', textAlign: 'center' }}>Shipping and taxes calculated at checkout.</p>
          <button 
            onClick={onCheckout}
            disabled={items.length === 0}
            className="checkout-btn"
          >
            Checkout
          </button>
        </div>
      </div>
    </>
  );
};

export default CartDrawer;