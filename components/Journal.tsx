/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { JOURNAL_ARTICLES } from '../constants';
import { JournalArticle } from '../types';

interface JournalProps {
  onArticleClick: (article: JournalArticle) => void;
}

const Journal: React.FC<JournalProps> = ({ onArticleClick }) => {
  return (
    <section id="journal" className="journal-section">
      <div className="container">
        <div className="journal-header">
            <div>
                <span className="feature-label" style={{ display: 'block', marginBottom: '1rem' }}>Editorial</span>
                <h2 className="section-title">The Journal</h2>
            </div>
        </div>

        <div className="journal-grid">
            {JOURNAL_ARTICLES.map((article) => (
                <div key={article.id} className="journal-card" onClick={() => onArticleClick(article)}>
                    <div className="journal-img-wrapper">
                        <img 
                            src={article.image} 
                            alt={article.title} 
                            className="journal-img"
                        />
                    </div>
                    <div className="journal-info">
                        <span className="journal-date">{article.date}</span>
                        <h3 className="journal-title">{article.title}</h3>
                        <p className="journal-excerpt">{article.excerpt}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default Journal;