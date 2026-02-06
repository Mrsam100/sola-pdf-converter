/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface Step {
    label: string;
}

interface StepProgressProps {
    steps: Step[];
    currentStep: number; // 0-indexed, -1 means not started
}

const StepProgress: React.FC<StepProgressProps> = ({ steps, currentStep }) => {
    return (
        <div className="step-progress" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={steps.length}>
            {steps.map((step, i) => (
                <div className="step-item" key={i}>
                    {i > 0 && (
                        <div className={`step-line${currentStep >= i ? ' active' : ''}`} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className={`step-circle${currentStep === i ? ' active' : ''}${currentStep > i ? ' completed' : ''}`}>
                            {currentStep > i ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" width="14" height="14">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            ) : (
                                i + 1
                            )}
                        </div>
                        <div className="step-label">{step.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StepProgress;
