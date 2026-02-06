/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PageId } from '../types';
import { BRAND_NAME, STUDIO_NAME } from '../constants';

interface LegalPageProps {
    pageId: PageId;
    onBack: () => void;
}

const LegalPage: React.FC<LegalPageProps> = ({ pageId, onBack }) => {
    const content = PAGE_CONTENT[pageId];

    return (
        <div className="detail-view animate-fade-in">
            <div className="container">
                <button className="back-btn" type="button" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back to Home
                </button>

                <div className="workspace-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ padding: '2.5rem 2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                                background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 22, height: 22, color: 'var(--text-primary)' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={content.icon} />
                                </svg>
                            </div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                {content.title}
                            </h1>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
                            Last updated: January 15, 2026
                        </p>

                        <div className="legal-content">
                            {content.sections.map((section, i) => (
                                <div key={i} style={{ marginBottom: '2rem' }}>
                                    <h2 style={{
                                        fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)',
                                        marginBottom: '0.75rem', paddingBottom: '0.5rem',
                                        borderBottom: '1px solid var(--border-color)',
                                    }}>
                                        {section.heading}
                                    </h2>
                                    {section.paragraphs.map((p, j) => (
                                        <p key={j} style={{
                                            fontSize: '0.925rem', lineHeight: 1.7, color: 'var(--text-secondary)',
                                            marginBottom: '0.75rem',
                                        }}>
                                            {p}
                                        </p>
                                    ))}
                                    {section.list && (
                                        <ul style={{
                                            paddingLeft: '1.5rem', margin: '0.5rem 0 0.75rem',
                                            listStyleType: 'disc',
                                        }}>
                                            {section.list.map((item, k) => (
                                                <li key={k} style={{
                                                    fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)',
                                                    marginBottom: '0.35rem',
                                                }}>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="workspace-footer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        {STUDIO_NAME} &mdash; Your privacy and security are our priority.
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PageSection {
    heading: string;
    paragraphs: string[];
    list?: string[];
}

interface PageContent {
    title: string;
    icon: string;
    sections: PageSection[];
}

const PAGE_CONTENT: Record<PageId, PageContent> = {
    privacy: {
        title: 'Privacy Policy',
        icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
        sections: [
            {
                heading: '1. Overview',
                paragraphs: [
                    `${BRAND_NAME} is a product of ${STUDIO_NAME}. We are committed to protecting your privacy. This Privacy Policy explains how we handle your data when you use our file conversion platform.`,
                    'The core principle behind our platform is simple: your files never leave your device. All processing happens entirely in your web browser using client-side technologies. We do not upload, store, or transmit your files to any server.',
                ],
            },
            {
                heading: '2. Data We Do Not Collect',
                paragraphs: [
                    'Because all file processing occurs locally in your browser, we have no access to:',
                ],
                list: [
                    'Your uploaded files (PDFs, images, documents, audio)',
                    'The content of your files before, during, or after conversion',
                    'File names, metadata, or any extracted text',
                    'Any personal information contained within your documents',
                ],
            },
            {
                heading: '3. Data We May Collect',
                paragraphs: [
                    'To improve the platform and ensure it operates correctly, we may collect minimal, anonymized usage analytics:',
                ],
                list: [
                    'Page views and general navigation patterns (no file data)',
                    'Browser type and version for compatibility purposes',
                    'Screen resolution for responsive design optimization',
                    'Conversion tool usage counts (e.g., "PDF to Word was used 50 times today" — no file content)',
                    'Error reports when something goes wrong (stack traces, no file data)',
                ],
            },
            {
                heading: '4. Cookies & Local Storage',
                paragraphs: [
                    'We use browser local storage to persist your tool configuration preferences (e.g., default page size, compression level) so you do not need to reconfigure them each visit. No tracking cookies are used. No third-party advertising cookies are set.',
                    'You can clear your stored preferences at any time by clearing your browser\'s local storage for this site.',
                ],
            },
            {
                heading: '5. Third-Party Services',
                paragraphs: [
                    'Our platform does not integrate with any third-party analytics, advertising, or tracking services that process your file data. The JavaScript libraries we use (PDF.js, pdf-lib, Tesseract.js, etc.) all run locally in your browser.',
                ],
            },
            {
                heading: '6. Data Security',
                paragraphs: [
                    'Since your files never leave your device, the risk of data breach through our platform is virtually eliminated. We serve our application over HTTPS to protect the integrity of the application code itself. We recommend keeping your browser up to date for the best security.',
                ],
            },
            {
                heading: '7. Children\'s Privacy',
                paragraphs: [
                    'Our service does not knowingly collect any personal information from children under 13. Since we do not collect personal data from any users, this applies universally.',
                ],
            },
            {
                heading: '8. Changes to This Policy',
                paragraphs: [
                    'We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the platform after changes constitutes acceptance of the revised policy.',
                ],
            },
            {
                heading: '9. Contact',
                paragraphs: [
                    `If you have questions about this Privacy Policy, please contact us at privacy@${BRAND_NAME.toLowerCase()}.app or visit our Contact Support page.`,
                ],
            },
        ],
    },

    terms: {
        title: 'Terms of Service',
        icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
        sections: [
            {
                heading: '1. Acceptance of Terms',
                paragraphs: [
                    `By accessing or using ${BRAND_NAME} (the "Service"), provided by ${STUDIO_NAME}, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.`,
                ],
            },
            {
                heading: '2. Description of Service',
                paragraphs: [
                    `${BRAND_NAME} is a browser-based file conversion platform. We provide tools to convert, merge, split, compress, edit, and process PDF documents, images, and other file formats. All processing occurs entirely within your web browser — no files are uploaded to our servers.`,
                ],
            },
            {
                heading: '3. User Responsibilities',
                paragraphs: [
                    'You are responsible for:',
                ],
                list: [
                    'Ensuring you have the legal right to process any files you use with our tools',
                    'Not using the Service to process files containing illegal content',
                    'Not attempting to reverse-engineer, decompile, or extract source code from the Service beyond what is permitted by applicable law',
                    'Not using automated scripts or bots to access the Service in a way that degrades performance for other users',
                    'Maintaining the security of your own device and browser',
                ],
            },
            {
                heading: '4. Intellectual Property',
                paragraphs: [
                    `The Service, including its design, code, and branding, is the intellectual property of ${STUDIO_NAME} and is protected by copyright and other intellectual property laws. You retain full ownership of all files you process through the Service. We claim no rights to your content.`,
                ],
            },
            {
                heading: '5. Limitation of Liability',
                paragraphs: [
                    `${BRAND_NAME} is provided "as is" without warranty of any kind, express or implied. We do not guarantee that conversions will be perfectly accurate in all cases, as results depend on the complexity and format of input files.`,
                    `${STUDIO_NAME} shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to data loss, file corruption, or inability to access the Service.`,
                ],
            },
            {
                heading: '6. Service Availability',
                paragraphs: [
                    'We strive to keep the Service available at all times, but we do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. Since processing happens locally, most features remain functional even with an intermittent connection after the initial page load.',
                ],
            },
            {
                heading: '7. Free Tier Limitations',
                paragraphs: [
                    'The free tier of the Service has the following limits:',
                ],
                list: [
                    'Maximum file size: 50 MB per PDF, 10 MB per image',
                    'Batch processing: up to 10 files at once',
                    'All core conversion features are included at no cost',
                ],
            },
            {
                heading: '8. Prohibited Uses',
                paragraphs: [
                    'You may not use the Service to:',
                ],
                list: [
                    'Process files that contain malware, viruses, or harmful code',
                    'Circumvent any technical limitations or security measures',
                    'Engage in any activity that disrupts or interferes with the Service',
                    'Violate any applicable local, national, or international law',
                ],
            },
            {
                heading: '9. Termination',
                paragraphs: [
                    'We reserve the right to restrict access to the Service at our discretion if these Terms are violated. Since no account is required, termination would apply to IP-level or browser-level access restrictions.',
                ],
            },
            {
                heading: '10. Governing Law',
                paragraphs: [
                    'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Gregorious Creative Studios operates, without regard to conflict of law principles.',
                ],
            },
            {
                heading: '11. Changes to Terms',
                paragraphs: [
                    'We may modify these Terms at any time. Changes will be effective immediately upon posting to this page. Your continued use of the Service after changes constitutes acceptance.',
                ],
            },
        ],
    },

    contact: {
        title: 'Contact Support',
        icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
        sections: [
            {
                heading: 'Get in Touch',
                paragraphs: [
                    `We're here to help. Whether you've encountered a bug, have a feature request, or need guidance using our tools, the ${BRAND_NAME} team is ready to assist.`,
                ],
            },
            {
                heading: 'Email Support',
                paragraphs: [
                    `For general inquiries and support requests, reach us at: support@${BRAND_NAME.toLowerCase()}.app`,
                    'We aim to respond within 24 hours on business days. Please include a clear description of your issue, including which tool you were using and the file type you were working with (no need to send the actual file).',
                ],
            },
            {
                heading: 'Bug Reports',
                paragraphs: [
                    'Found a bug? Help us fix it by providing:',
                ],
                list: [
                    'A clear description of what happened vs. what you expected',
                    'The tool you were using (e.g., "Merge PDF", "Image to PDF")',
                    'Your browser name and version (e.g., Chrome 120, Firefox 121)',
                    'Your operating system (e.g., Windows 11, macOS Sonoma, iOS 17)',
                    'Steps to reproduce the issue, if possible',
                    'Any error messages you saw on screen',
                ],
            },
            {
                heading: 'Feature Requests',
                paragraphs: [
                    `We actively develop ${BRAND_NAME} based on user feedback. If you have an idea for a new tool or improvement to an existing one, we would love to hear it. Send your suggestions to features@${BRAND_NAME.toLowerCase()}.app with a brief description of what you need and why.`,
                ],
            },
            {
                heading: 'Business & Partnership Inquiries',
                paragraphs: [
                    `For enterprise licensing, partnership opportunities, or custom integration requests, contact us at business@${BRAND_NAME.toLowerCase()}.app.`,
                ],
            },
            {
                heading: 'Security Disclosures',
                paragraphs: [
                    `If you have discovered a security vulnerability in our platform, please report it responsibly to security@${BRAND_NAME.toLowerCase()}.app. We take all reports seriously and will respond within 48 hours. Please do not disclose the vulnerability publicly until we have had a chance to address it.`,
                ],
            },
            {
                heading: 'Frequently Asked Questions',
                paragraphs: [
                    'Before reaching out, here are answers to common questions:',
                ],
                list: [
                    '"Are my files uploaded to a server?" — No. All processing happens in your browser. Your files never leave your device.',
                    '"Why did my conversion fail?" — Most failures are due to corrupted files, password-protected PDFs, or files exceeding the size limit (50 MB for PDFs, 10 MB for images).',
                    '"Do you support [format]?" — We support PDF, JPG, PNG, WebP, HEIC, Word (docx), and audio formats. Check our dashboard for the full list of tools.',
                    '"Is there a desktop app?" — Not yet. Our web app works offline after the first load thanks to service worker caching.',
                    '"Is the service free?" — Yes, all core features are free. No account required.',
                ],
            },
            {
                heading: 'Response Times',
                paragraphs: [
                    'General support: within 24 hours (business days). Bug reports: within 48 hours. Security issues: within 48 hours. Business inquiries: within 3 business days.',
                ],
            },
        ],
    },

    api: {
        title: 'API Access',
        icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
        sections: [
            {
                heading: 'Overview',
                paragraphs: [
                    `${BRAND_NAME} is primarily a client-side application — all file processing happens directly in your browser. However, we understand that developers and businesses may want to integrate our conversion capabilities into their own workflows.`,
                ],
            },
            {
                heading: 'Client-Side JavaScript API',
                paragraphs: [
                    `Since ${BRAND_NAME} processes files entirely in the browser, our conversion engines are available as JavaScript modules that you can use in your own applications. The core libraries we build on are open-source:`,
                ],
                list: [
                    'pdf-lib — Create and modify PDF documents (MIT license)',
                    'PDF.js — Render and extract text from PDFs (Apache 2.0 license)',
                    'Tesseract.js — Optical character recognition in the browser (Apache 2.0 license)',
                    'ONNX Runtime Web — AI-powered image processing (MIT license)',
                ],
            },
            {
                heading: 'Integration Examples',
                paragraphs: [
                    'You can use these libraries directly in your JavaScript/TypeScript projects to perform the same conversions that our platform offers:',
                    'PDF merging and splitting: Use pdf-lib to combine or extract pages from PDF documents programmatically.',
                    'PDF to image conversion: Use PDF.js to render PDF pages to canvas elements, then export as JPG or PNG.',
                    'OCR text extraction: Use Tesseract.js to extract text from images or scanned documents.',
                    'Image format conversion: Use the browser Canvas API to convert between JPG, PNG, and WebP formats.',
                ],
            },
            {
                heading: 'REST API (Coming Soon)',
                paragraphs: [
                    'We are developing a hosted REST API for server-side conversions, designed for use cases where client-side processing is not practical:',
                ],
                list: [
                    'Batch processing of large file volumes',
                    'Automated workflows and CI/CD pipelines',
                    'Server-to-server integrations where no browser is available',
                    'Processing files larger than browser memory limits',
                ],
            },
            {
                heading: 'Planned API Endpoints',
                paragraphs: [
                    'The following endpoints are planned for our initial API release:',
                ],
                list: [
                    'POST /api/v1/convert/pdf-to-word — Convert PDF to DOCX',
                    'POST /api/v1/convert/pdf-to-image — Convert PDF pages to images',
                    'POST /api/v1/convert/image-to-pdf — Combine images into a PDF',
                    'POST /api/v1/pdf/merge — Merge multiple PDFs',
                    'POST /api/v1/pdf/split — Split a PDF into parts',
                    'POST /api/v1/pdf/compress — Compress a PDF',
                    'POST /api/v1/ocr/extract — Extract text via OCR',
                ],
            },
            {
                heading: 'API Pricing',
                paragraphs: [
                    'The REST API will offer a free tier for individual developers and paid plans for higher volume usage:',
                ],
                list: [
                    'Free: 100 conversions/month, 10 MB max file size',
                    'Developer ($19/month): 2,000 conversions/month, 50 MB max file size',
                    'Business ($99/month): 20,000 conversions/month, 200 MB max file size, priority support',
                    'Enterprise: Custom volume, SLA, and dedicated support — contact us',
                ],
            },
            {
                heading: 'Early Access',
                paragraphs: [
                    `The API is currently in development. To join the early access program and be notified when it launches, send your name, use case, and expected volume to api@${BRAND_NAME.toLowerCase()}.app.`,
                    'Early access participants will receive 6 months of free Developer-tier access upon launch.',
                ],
            },
            {
                heading: 'Self-Hosting',
                paragraphs: [
                    `Because ${BRAND_NAME} is a static web application with no server dependencies for core features, you can self-host the entire platform on your own infrastructure. This is ideal for organizations that require complete data sovereignty.`,
                    `For self-hosting documentation and enterprise licensing, contact business@${BRAND_NAME.toLowerCase()}.app.`,
                ],
            },
        ],
    },
};

export default LegalPage;
