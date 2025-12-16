/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BackButtonProps {
  onBack: () => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Reusable Back Button component that properly handles navigation
 * Prevents default browser back behavior and stops event propagation
 */
const BackButton: React.FC<BackButtonProps> = ({ onBack, className = 'back-btn', children }) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onBack();
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      type="button"
    >
      {children || (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Dashboard
        </>
      )}
    </button>
  );
};

export default BackButton;
