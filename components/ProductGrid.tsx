/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { TOOLS } from '../constants';
import { Tool } from '../types';

interface ToolGridProps {
  onToolClick: (tool: Tool) => void;
}

const categories = ['All', 'PDF', 'Image', 'Text', 'Security'];

const ProductGrid: React.FC<ToolGridProps> = ({ onToolClick }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = useMemo(() => {
    return TOOLS.filter(tool => {
        const matchesCategory = activeCategory === 'All' || tool.category === activeCategory;
        const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              tool.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <section id="dashboard" className="dashboard">
      <div className="container">
        
        {/* Header Area */}
        <div className="dashboard-header">
          <div>
              <h2 className="section-title">The Suite</h2>
              <p className="section-desc">55+ Professional tools at your fingertips.</p>
          </div>

          <div className="controls">
              {/* Search */}
              <div className="search-box" role="search">
                  <input
                    type="text"
                    placeholder="Search tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    aria-label="Search tools"
                  />
                  <div className="search-icon-wrapper">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                  </div>
              </div>

              {/* Categories */}
              <div className="filter-group" role="tablist" aria-label="Filter by category">
                {categories.map(cat => (
                <button
                    key={cat}
                    role="tab"
                    aria-selected={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
                >
                    {cat}
                </button>
                ))}
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid-layout" role="list">
          {filteredTools.map((tool, index) => (
            <div
                key={tool.id}
                role="listitem"
                tabIndex={0}
                onClick={() => onToolClick(tool)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToolClick(tool); } }}
                className={`tool-card animate-fade-in stagger-${(index % 5) + 1}`}
                aria-label={`${tool.name} — ${tool.description}`}
            >
                <div>
                    <div className="tool-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon">
                            <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                        </svg>
                    </div>
                    <h3 className="tool-name">{tool.name}</h3>
                    <p className="tool-desc">{tool.description}</p>
                </div>

                <div className="card-footer">
                    <span className="card-category">{tool.category}</span>
                    <span className="arrow-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                        </svg>
                    </span>
                </div>
            </div>
          ))}
        </div>

        {filteredTools.length === 0 && (
            <div className="flex-center" style={{ padding: '6rem 0', color: 'var(--text-tertiary)' }}>
                <p>No tools found matching your criteria.</p>
            </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;