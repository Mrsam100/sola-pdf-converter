/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Tool } from '../types';
import {
    EditorState,
    TextElement,
    ImageElement,
    ShapeElement,
    AnnotationElement,
    DrawingPath,
    renderPDFPage,
    saveEditedPDF
} from '../services/pdfEditorService';
import { downloadPDF } from '../services/pdfService';

interface EditPDFProps {
    tool: Tool;
    onBack: () => void;
}

type EditorMode = 'view' | 'edit';
type ToolMode = 'select' | 'text' | 'image' | 'shape' | 'highlight' | 'draw' | 'erase';

const EditPDF: React.FC<EditPDFProps> = ({ tool, onBack }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [mode, setMode] = useState<EditorMode>('edit');
    const [toolMode, setToolMode] = useState<ToolMode>('select');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [zoom, setZoom] = useState<number>(100);
    const [pageCanvases, setPageCanvases] = useState<Map<number, HTMLCanvasElement>>(new Map());
    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);

    // Editor state
    const [editorState, setEditorState] = useState<EditorState>({
        texts: [],
        images: [],
        shapes: [],
        annotations: [],
        drawings: []
    });

    // Tool settings
    const [textSettings, setTextSettings] = useState({
        fontSize: 16,
        fontFamily: 'Helvetica',
        color: '#000000',
        bold: false,
        italic: false,
        underline: false
    });

    const [shapeSettings, setShapeSettings] = useState({
        type: 'rectangle' as 'rectangle' | 'circle' | 'line' | 'arrow',
        color: '#000000',
        strokeWidth: 2,
        fillColor: ''
    });

    const [drawSettings, setDrawSettings] = useState({
        color: '#000000',
        width: 3
    });

    const [highlightColor, setHighlightColor] = useState('#FFFF00');

    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentDrawing, setCurrentDrawing] = useState<{ x: number; y: number }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const editorCanvasRef = useRef<HTMLCanvasElement>(null);

    // File upload handlers
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
                alert('Please select a PDF file');
                return;
            }
            await loadPDF(file);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const file = event.dataTransfer.files?.[0];
        if (file) {
            if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
                alert('Please select a PDF file');
                return;
            }
            await loadPDF(file);
        }
    };

    const loadPDF = async (file: File) => {
        setLoading(true);
        try {
            setSelectedFile(file);

            // Get page count
            const { pdfjsLib } = await import('../services/pdfConfig');
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            setTotalPages(pdf.numPages);
            setCurrentPage(1);

            // Render first page
            await renderPage(file, 1);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Failed to load PDF');
        } finally {
            setLoading(false);
        }
    };

    const renderPage = async (file: File, pageNumber: number) => {
        try {
            const scale = zoom / 100 * 1.5;
            const { canvas } = await renderPDFPage(file, pageNumber, scale);

            setPageCanvases(prev => {
                const newMap = new Map(prev);
                newMap.set(pageNumber, canvas);
                return newMap;
            });

            // Draw canvas to editor canvas
            if (editorCanvasRef.current) {
                const ctx = editorCanvasRef.current.getContext('2d');
                if (ctx) {
                    editorCanvasRef.current.width = canvas.width;
                    editorCanvasRef.current.height = canvas.height;
                    ctx.drawImage(canvas, 0, 0);

                    // Redraw all elements
                    redrawElements(ctx, pageNumber);
                }
            }
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    };

    const redrawElements = (ctx: CanvasRenderingContext2D, pageNumber: number) => {
        // Draw texts
        editorState.texts
            .filter(t => t.pageNumber === pageNumber)
            .forEach(text => {
                ctx.font = `${text.fontSize}px ${text.fontFamily}`;
                ctx.fillStyle = text.color;
                ctx.fillText(text.text, text.x, text.y);
            });

        // Draw images
        editorState.images
            .filter(img => img.pageNumber === pageNumber)
            .forEach(imgEl => {
                const img = new Image();
                img.src = imgEl.imageData;
                img.onload = () => {
                    ctx.save();
                    ctx.globalAlpha = imgEl.opacity;
                    ctx.translate(imgEl.x + imgEl.width / 2, imgEl.y + imgEl.height / 2);
                    ctx.rotate((imgEl.rotation * Math.PI) / 180);
                    ctx.drawImage(img, -imgEl.width / 2, -imgEl.height / 2, imgEl.width, imgEl.height);
                    ctx.restore();
                };
            });

        // Draw shapes
        editorState.shapes
            .filter(s => s.pageNumber === pageNumber)
            .forEach(shape => {
                ctx.strokeStyle = shape.color;
                ctx.lineWidth = shape.strokeWidth;

                if (shape.fillColor) {
                    ctx.fillStyle = shape.fillColor;
                }

                if (shape.type === 'rectangle') {
                    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                    if (shape.fillColor) {
                        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                    }
                } else if (shape.type === 'circle') {
                    ctx.beginPath();
                    ctx.ellipse(
                        shape.x + shape.width / 2,
                        shape.y + shape.height / 2,
                        shape.width / 2,
                        shape.height / 2,
                        0, 0, 2 * Math.PI
                    );
                    ctx.stroke();
                    if (shape.fillColor) {
                        ctx.fill();
                    }
                } else if (shape.type === 'line') {
                    ctx.beginPath();
                    ctx.moveTo(shape.x, shape.y);
                    ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
                    ctx.stroke();
                }
            });

        // Draw annotations
        editorState.annotations
            .filter(a => a.pageNumber === pageNumber)
            .forEach(annotation => {
                if (annotation.type === 'highlight') {
                    ctx.fillStyle = annotation.color;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
                    ctx.globalAlpha = 1.0;
                }
            });

        // Draw drawings
        editorState.drawings
            .filter(d => d.pageNumber === pageNumber)
            .forEach(drawing => {
                ctx.strokeStyle = drawing.color;
                ctx.lineWidth = drawing.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                ctx.beginPath();
                if (drawing.points.length > 0) {
                    ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
                    for (let i = 1; i < drawing.points.length; i++) {
                        ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
                    }
                    ctx.stroke();
                }
            });
    };

    // Page navigation
    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages && selectedFile) {
            setCurrentPage(page);
            renderPage(selectedFile, page);
        }
    };

    // Zoom controls
    const handleZoom = (newZoom: number) => {
        setZoom(newZoom);
        if (selectedFile) {
            renderPage(selectedFile, currentPage);
        }
    };

    // Canvas interaction handlers
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'edit') return;

        const canvas = editorCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (toolMode === 'text') {
            const newText: TextElement = {
                id: Date.now().toString(),
                pageNumber: currentPage,
                x,
                y,
                text: 'New Text',
                ...textSettings,
                align: 'left'
            };

            setEditorState(prev => ({
                ...prev,
                texts: [...prev.texts, newText]
            }));

            // Redraw
            const ctx = canvas.getContext('2d');
            if (ctx) redrawElements(ctx, currentPage);
        }
    };

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'edit' || toolMode !== 'draw') return;

        const canvas = editorCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setIsDrawing(true);
        setCurrentDrawing([{ x, y }]);
    };

    const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || toolMode !== 'draw') return;

        const canvas = editorCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setCurrentDrawing(prev => [...prev, { x, y }]);

        // Draw preview
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = drawSettings.color;
            ctx.lineWidth = drawSettings.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (currentDrawing.length > 0) {
                const lastPoint = currentDrawing[currentDrawing.length - 1];
                ctx.beginPath();
                ctx.moveTo(lastPoint.x, lastPoint.y);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    };

    const handleCanvasMouseUp = () => {
        if (isDrawing && currentDrawing.length > 1) {
            const newDrawing: DrawingPath = {
                id: Date.now().toString(),
                pageNumber: currentPage,
                points: currentDrawing,
                color: drawSettings.color,
                width: drawSettings.width
            };

            setEditorState(prev => ({
                ...prev,
                drawings: [...prev.drawings, newDrawing]
            }));
        }

        setIsDrawing(false);
        setCurrentDrawing([]);
    };

    // Image upload handler
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target?.result as string;

            const newImage: ImageElement = {
                id: Date.now().toString(),
                pageNumber: currentPage,
                x: 100,
                y: 100,
                width: 200,
                height: 200,
                rotation: 0,
                opacity: 1,
                imageData
            };

            setEditorState(prev => ({
                ...prev,
                images: [...prev.images, newImage]
            }));

            // Redraw
            const canvas = editorCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) redrawElements(ctx, currentPage);
            }
        };
        reader.readAsDataURL(file);
    };

    // Save functionality
    const handleSave = async () => {
        if (!selectedFile) return;

        setSaving(true);
        try {
            const pdfBytes = await saveEditedPDF(selectedFile, editorState);
            const filename = selectedFile.name.replace('.pdf', '_edited.pdf');
            downloadPDF(pdfBytes, filename);
        } catch (error) {
            console.error('Error saving PDF:', error);
            alert('Failed to save PDF');
        } finally {
            setSaving(false);
        }
    };

    // Re-render when page or zoom changes
    useEffect(() => {
        if (selectedFile) {
            renderPage(selectedFile, currentPage);
        }
    }, [currentPage, zoom]);

    if (!selectedFile) {
        return (
            <div className="tool-detail">
                <div className="tool-detail-header">
                    <button className="back-btn" onClick={onBack}>
                        ← Back
                    </button>
                    <div className="tool-detail-title">
                        <div className="tool-detail-icon">{tool.icon}</div>
                        <div>
                            <h2>{tool.name}</h2>
                            <p>{tool.description}</p>
                        </div>
                    </div>
                </div>

                <div className="tool-content">
                    <div
                        className="upload-zone"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="upload-icon">📝</div>
                        <p className="upload-text">Click or drag PDF file here</p>
                        <p className="upload-subtext">Edit your PDF with powerful tools</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {loading && (
                        <div className="loader-container">
                            <div className="loader"></div>
                            <p>Loading PDF...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="pdf-editor-container">
            {/* Header */}
            <div className="editor-header">
                <button className="back-btn-editor" onClick={onBack}>
                    ← Back
                </button>

                <div className="editor-title">
                    <span className="file-name">{selectedFile.name}</span>
                </div>

                <div className="editor-actions">
                    <button
                        className={`mode-btn ${mode === 'view' ? 'active' : ''}`}
                        onClick={() => setMode('view')}
                    >
                        👁️ View
                    </button>
                    <button
                        className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
                        onClick={() => setMode('edit')}
                    >
                        ✏️ Edit
                    </button>
                    <button
                        className="save-btn"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : '💾 Save'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="editor-main">
                {/* Sidebar - Page thumbnails */}
                <div className="editor-sidebar">
                    <div className="sidebar-header">Pages</div>
                    <div className="pages-list">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <div
                                key={page}
                                className={`page-thumbnail ${currentPage === page ? 'active' : ''}`}
                                onClick={() => goToPage(page)}
                            >
                                <div className="thumbnail-preview">
                                    {page}
                                </div>
                                <div className="thumbnail-label">Page {page}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="editor-canvas-area" ref={canvasContainerRef}>
                    <canvas
                        ref={editorCanvasRef}
                        className="editor-canvas"
                        onClick={handleCanvasClick}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                    />
                </div>

                {/* Toolbar */}
                {mode === 'edit' && (
                    <div className="editor-toolbar">
                        <div className="toolbar-section">
                            <div className="section-title">Tools</div>
                            <button
                                className={`tool-btn ${toolMode === 'select' ? 'active' : ''}`}
                                onClick={() => setToolMode('select')}
                                title="Select"
                            >
                                ↖️
                            </button>
                            <button
                                className={`tool-btn ${toolMode === 'text' ? 'active' : ''}`}
                                onClick={() => setToolMode('text')}
                                title="Add Text"
                            >
                                T
                            </button>
                            <button
                                className={`tool-btn ${toolMode === 'image' ? 'active' : ''}`}
                                onClick={() => {
                                    setToolMode('image');
                                    document.getElementById('image-upload')?.click();
                                }}
                                title="Add Image"
                            >
                                🖼️
                            </button>
                            <input
                                id="image-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                            />
                            <button
                                className={`tool-btn ${toolMode === 'shape' ? 'active' : ''}`}
                                onClick={() => setToolMode('shape')}
                                title="Add Shape"
                            >
                                ⬜
                            </button>
                            <button
                                className={`tool-btn ${toolMode === 'highlight' ? 'active' : ''}`}
                                onClick={() => setToolMode('highlight')}
                                title="Highlight"
                            >
                                🖍️
                            </button>
                            <button
                                className={`tool-btn ${toolMode === 'draw' ? 'active' : ''}`}
                                onClick={() => setToolMode('draw')}
                                title="Draw"
                            >
                                ✏️
                            </button>
                            <button
                                className={`tool-btn ${toolMode === 'erase' ? 'active' : ''}`}
                                onClick={() => setToolMode('erase')}
                                title="Eraser"
                            >
                                🧹
                            </button>
                        </div>

                        {/* Text Tools */}
                        {toolMode === 'text' && (
                            <div className="toolbar-section">
                                <div className="section-title">Text</div>
                                <select
                                    value={textSettings.fontFamily}
                                    onChange={e => setTextSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                                    className="toolbar-select"
                                >
                                    <option value="Helvetica">Helvetica</option>
                                    <option value="Courier">Courier</option>
                                    <option value="Times New Roman">Times</option>
                                </select>
                                <input
                                    type="number"
                                    value={textSettings.fontSize}
                                    onChange={e => setTextSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                                    min="8"
                                    max="72"
                                    className="toolbar-input"
                                />
                                <input
                                    type="color"
                                    value={textSettings.color}
                                    onChange={e => setTextSettings(prev => ({ ...prev, color: e.target.value }))}
                                    className="toolbar-color"
                                />
                            </div>
                        )}

                        {/* Draw Tools */}
                        {toolMode === 'draw' && (
                            <div className="toolbar-section">
                                <div className="section-title">Draw</div>
                                <input
                                    type="color"
                                    value={drawSettings.color}
                                    onChange={e => setDrawSettings(prev => ({ ...prev, color: e.target.value }))}
                                    className="toolbar-color"
                                />
                                <input
                                    type="range"
                                    value={drawSettings.width}
                                    onChange={e => setDrawSettings(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                                    min="1"
                                    max="20"
                                    className="toolbar-range"
                                />
                                <span>{drawSettings.width}px</span>
                            </div>
                        )}

                        {/* Page Navigation */}
                        <div className="toolbar-section">
                            <div className="section-title">Page</div>
                            <button
                                className="nav-btn"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                ←
                            </button>
                            <span className="page-info">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                className="nav-btn"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                →
                            </button>
                        </div>

                        {/* Zoom Controls */}
                        <div className="toolbar-section">
                            <div className="section-title">Zoom</div>
                            <button
                                className="zoom-btn"
                                onClick={() => handleZoom(Math.max(50, zoom - 25))}
                            >
                                −
                            </button>
                            <span className="zoom-level">{zoom}%</span>
                            <button
                                className="zoom-btn"
                                onClick={() => handleZoom(Math.min(200, zoom + 25))}
                            >
                                +
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .pdf-editor-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #f5f5f5;
                    display: flex;
                    flex-direction: column;
                    z-index: 1000;
                }

                .editor-header {
                    background: white;
                    border-bottom: 1px solid #e0e0e0;
                    padding: 15px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .back-btn-editor {
                    background: #f0f0f0;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                }

                .back-btn-editor:hover {
                    background: #e0e0e0;
                }

                .editor-title {
                    flex: 1;
                    text-align: center;
                    font-weight: 600;
                    font-size: 16px;
                    color: #333;
                }

                .editor-actions {
                    display: flex;
                    gap: 10px;
                }

                .mode-btn {
                    background: #f0f0f0;
                    border: 2px solid transparent;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }

                .mode-btn.active {
                    background: #007bff;
                    color: white;
                    border-color: #0056b3;
                }

                .mode-btn:hover {
                    transform: translateY(-1px);
                }

                .save-btn {
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: background 0.2s;
                }

                .save-btn:hover:not(:disabled) {
                    background: #218838;
                }

                .save-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .editor-main {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                }

                .editor-sidebar {
                    width: 200px;
                    background: white;
                    border-right: 1px solid #e0e0e0;
                    display: flex;
                    flex-direction: column;
                }

                .sidebar-header {
                    padding: 15px;
                    border-bottom: 1px solid #e0e0e0;
                    font-weight: 600;
                    font-size: 14px;
                }

                .pages-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }

                .page-thumbnail {
                    margin-bottom: 10px;
                    cursor: pointer;
                    border: 2px solid transparent;
                    border-radius: 6px;
                    padding: 8px;
                    transition: all 0.2s;
                }

                .page-thumbnail:hover {
                    background: #f8f9fa;
                }

                .page-thumbnail.active {
                    border-color: #007bff;
                    background: #e7f3ff;
                }

                .thumbnail-preview {
                    width: 100%;
                    aspect-ratio: 8.5 / 11;
                    background: #f0f0f0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    color: #999;
                }

                .thumbnail-label {
                    text-align: center;
                    margin-top: 5px;
                    font-size: 12px;
                    color: #666;
                }

                .editor-canvas-area {
                    flex: 1;
                    overflow: auto;
                    background: #e0e0e0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }

                .editor-canvas {
                    background: white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    cursor: crosshair;
                }

                .editor-toolbar {
                    width: 250px;
                    background: white;
                    border-left: 1px solid #e0e0e0;
                    overflow-y: auto;
                    padding: 15px;
                }

                .toolbar-section {
                    margin-bottom: 25px;
                }

                .section-title {
                    font-weight: 600;
                    font-size: 13px;
                    color: #666;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .tool-btn {
                    width: 45px;
                    height: 45px;
                    border: 2px solid #e0e0e0;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 20px;
                    margin: 0 5px 5px 0;
                    transition: all 0.2s;
                }

                .tool-btn:hover {
                    background: #f8f9fa;
                    border-color: #007bff;
                }

                .tool-btn.active {
                    background: #007bff;
                    color: white;
                    border-color: #0056b3;
                }

                .toolbar-select, .toolbar-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    font-size: 13px;
                }

                .toolbar-color {
                    width: 50px;
                    height: 40px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .toolbar-range {
                    width: 100%;
                    margin: 5px 0;
                }

                .nav-btn, .zoom-btn {
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }

                .nav-btn:hover:not(:disabled), .zoom-btn:hover {
                    background: #f8f9fa;
                    border-color: #007bff;
                }

                .nav-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-info, .zoom-level {
                    margin: 0 10px;
                    font-size: 14px;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
};

export default EditPDF;
