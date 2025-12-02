/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import About from './components/About';
import Footer from './components/Footer';
import { ViewState } from './types';

function App() {
  const [view, setView] = useState<ViewState>({ type: 'home' });

  const handleNavClick = (e: React.MouseEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    if (targetId === 'home') {
        setView({ type: 'home' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (targetId === 'dashboard') {
        setView({ type: 'dashboard' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        const element = document.getElementById(targetId);
        if (element) {
             element.scrollIntoView({ behavior: 'smooth' });
        }
    }
  };

  return (
    <div>
      <Navbar 
          onNavClick={handleNavClick} 
          currentView={view.type}
      />
      
      <main>
        {view.type === 'home' && (
          <>
            <Hero onExplore={() => setView({ type: 'dashboard' })} />
            <ProductGrid 
                onToolClick={(tool) => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setView({ type: 'tool', tool: tool });
                }} 
            />
            <About />
          </>
        )}

        {view.type === 'dashboard' && (
            <div className="dashboard-view">
                 <ProductGrid 
                    onToolClick={(tool) => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setView({ type: 'tool', tool: tool });
                    }} 
                />
            </div>
        )}

        {view.type === 'tool' && (
          <ProductDetail 
            tool={view.tool} 
            onBack={() => setView({ type: 'dashboard' })}
          />
        )}
      </main>

      <Footer onLinkClick={handleNavClick} />
    </div>
  );
}

export default App;