/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { JournalArticle } from '../types';

interface JournalDetailProps {
  article: JournalArticle;
  onBack: () => void;
}

const JournalDetail: React.FC<JournalDetailProps> = ({ article, onBack }) => {
  return (
    <div className="journal-detail-page animate-fade-in">
       {/* Hero Image */}
       <div className="article-hero">
          <img 
             src={article.image} 
             alt={article.title} 
          />
          <div className="article-overlay"></div>
       </div>

       <div className="article-container">
          <div className="article-card">
             <div className="article-nav">
                <button 
                  onClick={onBack}
                  className="back-btn"
                  style={{ marginBottom: 0 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Back to Journal
                </button>
                <span className="article-date">{article.date}</span>
             </div>

             <h1 className="article-title">
               {article.title}
             </h1>

             <div className="article-body">
               {article.content}
             </div>
             
             <div className="article-footer">
                 <span className="brand-sign">Aura</span>
             </div>
          </div>
       </div>
    </div>
  );
};

export default JournalDetail;