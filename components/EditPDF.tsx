/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool } from '../types';
import {
    EditorState,
    TextElement,
    ImageElement,
    ShapeElement,
    AnnotationElement,
    DrawingPath,
    WhiteoutElement,
    DetectedTextItem,
    renderPDFPageFromDoc,
    extractTextItemsFromDoc,
    saveEditedPDF
} from '../services/pdfEditorService';
import { downloadPDF } from '../services/pdfService';
import { toast } from '../hooks/useToast';
import { useWakeLock } from '../hooks/usePageVisibility';
import BackButton from './BackButton';

interface EditPDFProps {
    tool: Tool;
    onBack: () => void;
}

type ToolType = 'select' | 'text' | 'draw' | 'shape' | 'highlight' | 'eraser' | 'image';

interface EditorCommand {
    execute: () => void;
    undo: () => void;
    description: string;
}

const MAX_HISTORY = 50;

const EditPDF: React.FC<EditPDFProps> = ({ tool, onBack }) => {
    // Core state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [zoom, setZoom] = useState(100);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Editor
    const [toolMode, setToolMode] = useState<ToolType>('select');
    const [editorState, setEditorState] = useState<EditorState>({
        texts: [], images: [], shapes: [], annotations: [], drawings: [], whiteouts: []
    });
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [detectedTexts, setDetectedTexts] = useState<Map<number, DetectedTextItem[]>>(new Map());

    // Undo/Redo
    const [history, setHistory] = useState<EditorCommand[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Drawing / interaction state
    const [isInteracting, setIsInteracting] = useState(false);
    const [interactionStart, setInteractionStart] = useState<{ x: number; y: number } | null>(null);
    const [currentDrawingPoints, setCurrentDrawingPoints] = useState<{ x: number; y: number }[]>([]);
    const [previewShape, setPreviewShape] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // Editing text inline
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState('');
    const [editingTextPos, setEditingTextPos] = useState<{ x: number; y: number; fontSize: number; fontFamily: string; color: string } | null>(null);
    const [newTextPos, setNewTextPos] = useState<{ x: number; y: number } | null>(null);

    // Tool settings
    const [textSettings, setTextSettings] = useState({ fontSize: 16, fontFamily: 'Helvetica', color: '#000000' });
    const [drawSettings, setDrawSettings] = useState({ color: '#000000', width: 3 });
    const [shapeSettings, setShapeSettings] = useState({ type: 'rectangle' as 'rectangle' | 'circle' | 'line', color: '#000000', strokeWidth: 2, fillColor: '' });
    const [highlightColor, setHighlightColor] = useState('#FFFF00');

    // Element move/resize
    const [movingElement, setMovingElement] = useState<{ id: string; type: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const editOverlayRef = useRef<HTMLDivElement>(null);
    const inlineInputRef = useRef<HTMLTextAreaElement>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const pdfDocProxyRef = useRef<any>(null);

    // Wake lock during save
    useWakeLock(saving);

    // Cleanup PDF document on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (pdfDocProxyRef.current) {
                pdfDocProxyRef.current.destroy();
                pdfDocProxyRef.current = null;
            }
        };
    }, []);

    const scale = zoom / 100 * 1.5;
    const hasUnsavedChanges = history.length > 0;

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasUnsavedChanges]);

    // ──────────────────────────────────
    // Undo / Redo helpers
    // ──────────────────────────────────
    const pushCommand = useCallback((cmd: EditorCommand) => {
        cmd.execute();
        setHistory(prev => {
            const truncated = prev.slice(0, historyIndex + 1);
            const next = [...truncated, cmd];
            if (next.length > MAX_HISTORY) next.shift();
            return next;
        });
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex < 0) return;
        history[historyIndex].undo();
        setHistoryIndex(prev => prev - 1);
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const next = historyIndex + 1;
        history[next].execute();
        setHistoryIndex(next);
    }, [history, historyIndex]);

    // ──────────────────────────────────
    // File handling
    // ──────────────────────────────────
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            setErrorMsg('Please select a valid PDF file');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            setErrorMsg('File is too large. Maximum size is 50 MB');
            return;
        }

        setErrorMsg('');
        await loadPDF(file);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            setErrorMsg('Please select a valid PDF file');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            setErrorMsg('File is too large. Maximum size is 50 MB');
            return;
        }
        setErrorMsg('');
        await loadPDF(file);
    };

    const loadPDF = async (file: File) => {
        setLoading(true);
        try {
            // Magic byte validation: PDF files start with %PDF
            const headerBytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
            const header = String.fromCharCode(...headerBytes);
            if (!header.startsWith('%PDF')) {
                setErrorMsg('File does not appear to be a valid PDF (invalid header).');
                setLoading(false);
                return;
            }

            const { pdfjsLib } = await import('../services/pdfConfig');
            const ab = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

            pdfDocProxyRef.current = pdf;
            setSelectedFile(file);
            setTotalPages(pdf.numPages);
            setCurrentPage(1);
            setEditorState({ texts: [], images: [], shapes: [], annotations: [], drawings: [], whiteouts: [] });
            setHistory([]);
            setHistoryIndex(-1);
            setSelectedElementId(null);
        } catch (err) {
            setErrorMsg('Failed to load PDF. The file may be corrupted or password-protected.');
        } finally {
            setLoading(false);
        }
    };

    // ──────────────────────────────────
    // Render page
    // ──────────────────────────────────
    const renderCurrentPage = useCallback(async () => {
        if (!selectedFile || !canvasRef.current) return;
        setPageLoading(true);

        try {
            if (!pdfDocProxyRef.current) return;
            const { canvas, width, height } = await renderPDFPageFromDoc(pdfDocProxyRef.current, currentPage, scale);
            const target = canvasRef.current;
            target.width = width;
            target.height = height;
            const ctx = target.getContext('2d');
            if (!ctx) return;

            // Draw base PDF
            ctx.drawImage(canvas, 0, 0);

            // Draw whiteouts on canvas
            editorState.whiteouts
                .filter(w => w.pageNumber === currentPage)
                .forEach(w => {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                });

            // Draw shapes on canvas
            editorState.shapes
                .filter(s => s.pageNumber === currentPage)
                .forEach(shape => {
                    ctx.strokeStyle = shape.color;
                    ctx.lineWidth = shape.strokeWidth;
                    if (shape.type === 'rectangle') {
                        if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fillRect(shape.x, shape.y, shape.width, shape.height); }
                        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                    } else if (shape.type === 'circle') {
                        ctx.beginPath();
                        ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2);
                        if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fill(); }
                        ctx.stroke();
                    } else if (shape.type === 'line') {
                        ctx.beginPath();
                        ctx.moveTo(shape.x, shape.y);
                        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
                        ctx.stroke();
                    }
                });

            // Draw annotations (highlights)
            editorState.annotations
                .filter(a => a.pageNumber === currentPage)
                .forEach(a => {
                    if (a.type === 'highlight') {
                        ctx.fillStyle = a.color;
                        ctx.globalAlpha = 0.35;
                        ctx.fillRect(a.x, a.y, a.width, a.height);
                        ctx.globalAlpha = 1;
                    }
                });

            // Draw drawings
            editorState.drawings
                .filter(d => d.pageNumber === currentPage)
                .forEach(d => {
                    ctx.strokeStyle = d.color;
                    ctx.lineWidth = d.width;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    if (d.points.length > 0) {
                        ctx.moveTo(d.points[0].x, d.points[0].y);
                        for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x, d.points[i].y);
                        ctx.stroke();
                    }
                });

            // Draw preview shape
            if (previewShape) {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = shapeSettings.color;
                ctx.lineWidth = shapeSettings.strokeWidth;
                if (toolMode === 'shape') {
                    if (shapeSettings.type === 'rectangle') {
                        ctx.strokeRect(previewShape.x, previewShape.y, previewShape.w, previewShape.h);
                    } else if (shapeSettings.type === 'circle') {
                        ctx.beginPath();
                        ctx.ellipse(previewShape.x + previewShape.w / 2, previewShape.y + previewShape.h / 2, Math.abs(previewShape.w / 2), Math.abs(previewShape.h / 2), 0, 0, Math.PI * 2);
                        ctx.stroke();
                    } else if (shapeSettings.type === 'line') {
                        ctx.beginPath();
                        ctx.moveTo(previewShape.x, previewShape.y);
                        ctx.lineTo(previewShape.x + previewShape.w, previewShape.y + previewShape.h);
                        ctx.stroke();
                    }
                } else if (toolMode === 'highlight') {
                    ctx.fillStyle = highlightColor;
                    ctx.globalAlpha = 0.35;
                    ctx.fillRect(previewShape.x, previewShape.y, previewShape.w, previewShape.h);
                    ctx.globalAlpha = 1;
                } else if (toolMode === 'eraser') {
                    ctx.strokeStyle = '#9CA3AF';
                    ctx.strokeRect(previewShape.x, previewShape.y, previewShape.w, previewShape.h);
                }
                ctx.setLineDash([]);
            }

            // Draw selection indicator
            if (selectedElementId) {
                const allElements = [
                    ...editorState.texts.map(t => ({ ...t, _type: 'text' })),
                    ...editorState.shapes.map(s => ({ ...s, _type: 'shape' })),
                    ...editorState.images.map(i => ({ ...i, _type: 'image' })),
                    ...editorState.whiteouts.map(w => ({ ...w, _type: 'whiteout' })),
                    ...editorState.annotations.map(a => ({ ...a, _type: 'annotation' })),
                ];
                const el = allElements.find(e => e.id === selectedElementId);
                if (el && 'x' in el && 'y' in el && 'width' in el && 'height' in el) {
                    const r = el as any;
                    const w = r.width || 100;
                    const h = r.height || (r.fontSize || 16);
                    ctx.setLineDash([4, 4]);
                    ctx.strokeStyle = '#2563eb';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(r.x - 4, r.y - 4, w + 8, h + 8);
                    ctx.setLineDash([]);
                    // Corner handles
                    const handles = [
                        [r.x - 4, r.y - 4], [r.x + w + 4, r.y - 4],
                        [r.x - 4, r.y + h + 4], [r.x + w + 4, r.y + h + 4],
                    ];
                    handles.forEach(([hx, hy]) => {
                        ctx.fillStyle = '#2563eb';
                        ctx.fillRect(hx - 4, hy - 4, 8, 8);
                    });
                }
            }
        } catch {
            // Render failed — silently handled, page loading spinner will clear
        } finally {
            setPageLoading(false);
        }
    }, [selectedFile, currentPage, scale, editorState, previewShape, selectedElementId, toolMode, shapeSettings, highlightColor]);

    // ──────────────────────────────────
    // Text detection
    // ──────────────────────────────────
    const loadTextDetection = useCallback(async () => {
        if (!selectedFile || !pdfDocProxyRef.current) return;
        try {
            const items = await extractTextItemsFromDoc(pdfDocProxyRef.current, currentPage, scale);
            setDetectedTexts(prev => {
                const next = new Map(prev);
                next.set(currentPage, items);
                return next;
            });
        } catch {
            // Text detection failed — non-critical, silently handled
        }
    }, [selectedFile, currentPage, scale]);

    // Re-render on state changes
    useEffect(() => {
        renderCurrentPage();
    }, [renderCurrentPage]);

    // Load text detection when page changes
    useEffect(() => {
        if (selectedFile) loadTextDetection();
    }, [selectedFile, currentPage, scale, loadTextDetection]);

    // ──────────────────────────────────
    // Delete selected element
    // ──────────────────────────────────
    const deleteSelectedElement = useCallback(() => {
        if (!selectedElementId) return;
        const id = selectedElementId;
        const snapshot: EditorState = {
            texts: [...editorState.texts],
            images: [...editorState.images],
            shapes: [...editorState.shapes],
            annotations: [...editorState.annotations],
            drawings: [...editorState.drawings],
            whiteouts: [...editorState.whiteouts],
        };

        pushCommand({
            description: 'Delete element',
            execute: () => {
                setEditorState(s => ({
                    ...s,
                    texts: s.texts.filter(t => t.id !== id),
                    images: s.images.filter(i => i.id !== id),
                    shapes: s.shapes.filter(sh => sh.id !== id),
                    annotations: s.annotations.filter(a => a.id !== id),
                    drawings: s.drawings.filter(d => d.id !== id),
                    whiteouts: s.whiteouts.filter(w => w.id !== id),
                }));
                setSelectedElementId(null);
            },
            undo: () => setEditorState(snapshot),
        });
    }, [selectedElementId, editorState, pushCommand]);

    // ──────────────────────────────────
    // Canvas mouse handlers
    // ──────────────────────────────────
    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX: number, clientY: number;
        if ('touches' in e) {
            // Use changedTouches for touchend (touches array is empty at touchend)
            const touch = e.touches[0] || e.changedTouches?.[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const handleCanvasMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCanvasCoords(e);
        if (!coords) return;

        // If editing inline text, ignore
        if (editingTextId || newTextPos) return;

        if (toolMode === 'select') {
            // Check if clicking on an element
            const hit = findElementAtPoint(coords.x, coords.y);
            if (hit) {
                setSelectedElementId(hit.id);
                setMovingElement({ id: hit.id, type: hit.type, startX: coords.x, startY: coords.y, origX: hit.x, origY: hit.y });
                setIsInteracting(true);
            } else {
                setSelectedElementId(null);
            }
            return;
        }

        if (toolMode === 'text') {
            setNewTextPos({ x: coords.x, y: coords.y });
            setEditingTextValue('');
            setTimeout(() => inlineInputRef.current?.focus(), 50);
            return;
        }

        if (toolMode === 'draw') {
            setIsInteracting(true);
            setCurrentDrawingPoints([coords]);
            return;
        }

        if (toolMode === 'shape' || toolMode === 'highlight' || toolMode === 'eraser') {
            setIsInteracting(true);
            setInteractionStart(coords);
            return;
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCanvasCoords(e);
        if (!coords || !isInteracting) return;

        if (toolMode === 'select' && movingElement) {
            const dx = coords.x - movingElement.startX;
            const dy = coords.y - movingElement.startY;
            const newX = movingElement.origX + dx;
            const newY = movingElement.origY + dy;

            setEditorState(s => {
                const update = (arr: any[]) => arr.map((el: any) =>
                    el.id === movingElement.id ? { ...el, x: newX, y: newY } : el
                );
                return {
                    ...s,
                    texts: update(s.texts),
                    images: update(s.images),
                    shapes: update(s.shapes),
                    annotations: update(s.annotations),
                    whiteouts: update(s.whiteouts),
                };
            });
            return;
        }

        if (toolMode === 'draw') {
            setCurrentDrawingPoints(prev => [...prev, coords]);
            // Live preview on canvas
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && currentDrawingPoints.length > 0) {
                const last = currentDrawingPoints[currentDrawingPoints.length - 1];
                ctx.strokeStyle = drawSettings.color;
                ctx.lineWidth = drawSettings.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(last.x, last.y);
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
            }
            return;
        }

        if ((toolMode === 'shape' || toolMode === 'highlight' || toolMode === 'eraser') && interactionStart) {
            setPreviewShape({
                x: Math.min(interactionStart.x, coords.x),
                y: Math.min(interactionStart.y, coords.y),
                w: Math.abs(coords.x - interactionStart.x),
                h: Math.abs(coords.y - interactionStart.y),
            });
        }
    };

    const handleCanvasMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCanvasCoords(e);

        if (toolMode === 'select' && movingElement && coords) {
            const dx = coords.x - movingElement.startX;
            const dy = coords.y - movingElement.startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                const id = movingElement.id;
                const origX = movingElement.origX;
                const origY = movingElement.origY;
                const newX = origX + dx;
                const newY = origY + dy;
                // Already moved in state via mousemove, just record for undo
                setHistory(prev => {
                    const cmd: EditorCommand = {
                        description: 'Move element',
                        execute: () => {
                            setEditorState(s => {
                                const update = (arr: any[]) => arr.map((el: any) =>
                                    el.id === id ? { ...el, x: newX, y: newY } : el
                                );
                                return { ...s, texts: update(s.texts), images: update(s.images), shapes: update(s.shapes), annotations: update(s.annotations), whiteouts: update(s.whiteouts) };
                            });
                        },
                        undo: () => {
                            setEditorState(s => {
                                const update = (arr: any[]) => arr.map((el: any) =>
                                    el.id === id ? { ...el, x: origX, y: origY } : el
                                );
                                return { ...s, texts: update(s.texts), images: update(s.images), shapes: update(s.shapes), annotations: update(s.annotations), whiteouts: update(s.whiteouts) };
                            });
                        },
                    };
                    const truncated = prev.slice(0, historyIndex + 1);
                    return [...truncated, cmd];
                });
                setHistoryIndex(prev => prev + 1);
            }
            setMovingElement(null);
            setIsInteracting(false);
            return;
        }

        if (toolMode === 'draw' && currentDrawingPoints.length > 1) {
            const points = [...currentDrawingPoints];
            const newDrawing: DrawingPath = {
                id: `draw-${Date.now()}`,
                pageNumber: currentPage,
                points,
                color: drawSettings.color,
                width: drawSettings.width,
            };
            pushCommand({
                description: 'Add drawing',
                execute: () => setEditorState(s => ({ ...s, drawings: [...s.drawings, newDrawing] })),
                undo: () => setEditorState(s => ({ ...s, drawings: s.drawings.filter(d => d.id !== newDrawing.id) })),
            });
        }

        if ((toolMode === 'shape') && interactionStart && coords) {
            const x = Math.min(interactionStart.x, coords.x);
            const y = Math.min(interactionStart.y, coords.y);
            const w = Math.abs(coords.x - interactionStart.x);
            const h = Math.abs(coords.y - interactionStart.y);
            if (w > 5 && h > 5) {
                const newShape: ShapeElement = {
                    id: `shape-${Date.now()}`,
                    pageNumber: currentPage,
                    type: shapeSettings.type,
                    x, y, width: w, height: h,
                    color: shapeSettings.color,
                    strokeWidth: shapeSettings.strokeWidth,
                    fillColor: shapeSettings.fillColor || undefined,
                };
                pushCommand({
                    description: 'Add shape',
                    execute: () => setEditorState(s => ({ ...s, shapes: [...s.shapes, newShape] })),
                    undo: () => setEditorState(s => ({ ...s, shapes: s.shapes.filter(sh => sh.id !== newShape.id) })),
                });
            }
        }

        if (toolMode === 'highlight' && interactionStart && coords) {
            const x = Math.min(interactionStart.x, coords.x);
            const y = Math.min(interactionStart.y, coords.y);
            const w = Math.abs(coords.x - interactionStart.x);
            const h = Math.abs(coords.y - interactionStart.y);
            if (w > 5 && h > 5) {
                const newAnn: AnnotationElement = {
                    id: `highlight-${Date.now()}`,
                    pageNumber: currentPage,
                    type: 'highlight',
                    x, y, width: w, height: h,
                    color: highlightColor,
                };
                pushCommand({
                    description: 'Add highlight',
                    execute: () => setEditorState(s => ({ ...s, annotations: [...s.annotations, newAnn] })),
                    undo: () => setEditorState(s => ({ ...s, annotations: s.annotations.filter(a => a.id !== newAnn.id) })),
                });
            }
        }

        if (toolMode === 'eraser' && interactionStart && coords) {
            const x = Math.min(interactionStart.x, coords.x);
            const y = Math.min(interactionStart.y, coords.y);
            const w = Math.abs(coords.x - interactionStart.x);
            const h = Math.abs(coords.y - interactionStart.y);
            if (w > 5 && h > 5) {
                const newWhiteout: WhiteoutElement = {
                    id: `whiteout-${Date.now()}`,
                    pageNumber: currentPage,
                    x, y, width: w, height: h,
                };
                pushCommand({
                    description: 'Add whiteout',
                    execute: () => setEditorState(s => ({ ...s, whiteouts: [...s.whiteouts, newWhiteout] })),
                    undo: () => setEditorState(s => ({ ...s, whiteouts: s.whiteouts.filter(wo => wo.id !== newWhiteout.id) })),
                });
            }
        }

        setIsInteracting(false);
        setInteractionStart(null);
        setCurrentDrawingPoints([]);
        setPreviewShape(null);
    };

    // ──────────────────────────────────
    // Hit detection for select mode
    // ──────────────────────────────────
    const findElementAtPoint = (px: number, py: number): { id: string; type: string; x: number; y: number } | null => {
        // Check texts — use canvas measureText for accurate width
        for (const t of editorState.texts.filter(t => t.pageNumber === currentPage)) {
            const ctx = canvasRef.current?.getContext('2d');
            let w: number;
            if (ctx) {
                ctx.font = `${t.fontSize}px ${t.fontFamily}`;
                w = ctx.measureText(t.text).width;
            } else {
                w = t.text.length * t.fontSize * 0.55;
            }
            const h = t.fontSize * 1.2;
            if (px >= t.x - 4 && px <= t.x + w + 4 && py >= t.y - 4 && py <= t.y + h + 4) {
                return { id: t.id, type: 'text', x: t.x, y: t.y };
            }
        }
        // Check shapes
        for (const s of editorState.shapes.filter(s => s.pageNumber === currentPage)) {
            if (px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height) {
                return { id: s.id, type: 'shape', x: s.x, y: s.y };
            }
        }
        // Check images
        for (const i of editorState.images.filter(i => i.pageNumber === currentPage)) {
            if (px >= i.x && px <= i.x + i.width && py >= i.y && py <= i.y + i.height) {
                return { id: i.id, type: 'image', x: i.x, y: i.y };
            }
        }
        // Check annotations
        for (const a of editorState.annotations.filter(a => a.pageNumber === currentPage)) {
            if (px >= a.x && px <= a.x + a.width && py >= a.y && py <= a.y + a.height) {
                return { id: a.id, type: 'annotation', x: a.x, y: a.y };
            }
        }
        // Check drawings — bounding box hit test
        for (const d of editorState.drawings.filter(d => d.pageNumber === currentPage)) {
            if (d.points.length === 0) continue;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of d.points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            const pad = d.width / 2 + 6;
            if (px >= minX - pad && px <= maxX + pad && py >= minY - pad && py <= maxY + pad) {
                return { id: d.id, type: 'drawing', x: minX, y: minY };
            }
        }
        // Check whiteouts
        for (const w of editorState.whiteouts.filter(w => w.pageNumber === currentPage)) {
            if (px >= w.x && px <= w.x + w.width && py >= w.y && py <= w.y + w.height) {
                return { id: w.id, type: 'whiteout', x: w.x, y: w.y };
            }
        }
        return null;
    };

    // ──────────────────────────────────
    // Text detection click handler
    // ──────────────────────────────────
    const handleDetectedTextClick = (item: DetectedTextItem) => {
        setEditingTextId(item.id);
        setEditingTextValue(item.text);
        setEditingTextPos({
            x: item.x, y: item.y,
            fontSize: item.fontSize,
            fontFamily: 'Helvetica',
            color: item.color,
        });
        setTimeout(() => inlineInputRef.current?.focus(), 50);
    };

    // ──────────────────────────────────
    // Commit inline text edit
    // ──────────────────────────────────
    const commitTextEdit = useCallback(() => {
        if (editingTextId && editingTextPos && editingTextValue.trim()) {
            const detected = detectedTexts.get(currentPage)?.find(d => d.id === editingTextId);
            if (detected) {
                // Editing existing detected text: create whiteout + new text
                const whiteout: WhiteoutElement = {
                    id: `wo-${Date.now()}`,
                    pageNumber: currentPage,
                    x: detected.x - 2,
                    y: detected.y - 2,
                    width: detected.width + 4,
                    height: detected.height + 4,
                };
                const newText: TextElement = {
                    id: `text-${Date.now()}`,
                    pageNumber: currentPage,
                    x: detected.x,
                    y: detected.y,
                    text: editingTextValue,
                    fontSize: detected.fontSize, // Keep in canvas coords — service divides by scale
                    fontFamily: 'Helvetica',
                    color: detected.color,
                    bold: false, italic: false, underline: false,
                    align: 'left',
                };
                pushCommand({
                    description: 'Edit text',
                    execute: () => setEditorState(s => ({
                        ...s,
                        whiteouts: [...s.whiteouts, whiteout],
                        texts: [...s.texts, newText],
                    })),
                    undo: () => setEditorState(s => ({
                        ...s,
                        whiteouts: s.whiteouts.filter(w => w.id !== whiteout.id),
                        texts: s.texts.filter(t => t.id !== newText.id),
                    })),
                });
            }
        }
        setEditingTextId(null);
        setEditingTextPos(null);
        setEditingTextValue('');
    }, [editingTextId, editingTextPos, editingTextValue, currentPage, detectedTexts, scale, pushCommand]);

    // ──────────────────────────────────
    // Commit new text
    // ──────────────────────────────────
    const commitNewText = useCallback(() => {
        if (newTextPos && editingTextValue.trim()) {
            const newText: TextElement = {
                id: `text-${Date.now()}`,
                pageNumber: currentPage,
                x: newTextPos.x, // Canvas coords — service divides by scale on save
                y: newTextPos.y,
                text: editingTextValue,
                fontSize: textSettings.fontSize * scale, // Canvas-scale fontSize
                fontFamily: textSettings.fontFamily,
                color: textSettings.color,
                bold: false, italic: false, underline: false,
                align: 'left',
            };
            pushCommand({
                description: 'Add text',
                execute: () => setEditorState(s => ({ ...s, texts: [...s.texts, newText] })),
                undo: () => setEditorState(s => ({ ...s, texts: s.texts.filter(t => t.id !== newText.id) })),
            });
        }
        setNewTextPos(null);
        setEditingTextValue('');
    }, [newTextPos, editingTextValue, currentPage, scale, textSettings, pushCommand]);

    // ──────────────────────────────────
    // Image upload
    // ──────────────────────────────────
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate image type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please select a PNG or JPEG image. WebP is not supported for PDF embedding.');
            return;
        }
        // Validate image size (max 10 MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image is too large. Maximum size is 10 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const imageData = ev.target?.result as string;
            const newImage: ImageElement = {
                id: `img-${Date.now()}`,
                pageNumber: currentPage,
                x: canvasRef.current ? canvasRef.current.width / 2 - 100 : 100,
                y: canvasRef.current ? canvasRef.current.height / 2 - 100 : 100,
                width: 200, height: 200,
                rotation: 0, opacity: 1,
                imageData,
            };
            pushCommand({
                description: 'Add image',
                execute: () => setEditorState(s => ({ ...s, images: [...s.images, newImage] })),
                undo: () => setEditorState(s => ({ ...s, images: s.images.filter(i => i.id !== newImage.id) })),
            });
        };
        reader.readAsDataURL(file);
    };

    // ──────────────────────────────────
    // Save
    // ──────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!selectedFile) return;
        setSaving(true);
        try {
            const pdfBytes = await saveEditedPDF(selectedFile, editorState, scale);
            const filename = selectedFile.name.replace('.pdf', '_edited.pdf');
            downloadPDF(pdfBytes, filename);
            toast.success('PDF saved successfully!');
        } catch {
            toast.error('Failed to save PDF. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [selectedFile, editorState, scale]);

    // ──────────────────────────────────
    // Keyboard shortcuts
    // ──────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
                if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
                if (e.key === 's') { e.preventDefault(); handleSave(); }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedElementId && !editingTextId && !newTextPos) {
                    e.preventDefault();
                    deleteSelectedElement();
                }
            }
            if (e.key === 'Escape') {
                setSelectedElementId(null);
                setEditingTextId(null);
                setNewTextPos(null);
                setToolMode('select');
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo, selectedElementId, editingTextId, newTextPos, handleSave, deleteSelectedElement]);

    // ──────────────────────────────────
    // Page navigation
    // ──────────────────────────────────
    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            // Commit any pending text edit before switching pages
            if (editingTextId) commitTextEdit();
            if (newTextPos) commitNewText();
            setCurrentPage(page);
            setSelectedElementId(null);
            setEditingTextId(null);
            setNewTextPos(null);
        }
    };

    // ──────────────────────────────────
    // Zoom
    // ──────────────────────────────────
    const handleZoom = (delta: number) => {
        setZoom(prev => Math.max(50, Math.min(200, prev + delta)));
    };

    // ──────────────────────────────────
    // Get canvas rect for overlay positioning
    // ──────────────────────────────────
    const getOverlayStyle = (): React.CSSProperties => {
        const canvas = canvasRef.current;
        if (!canvas) return { display: 'none' };
        return {
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            pointerEvents: 'none',
        };
    };

    // ──────────────────────────────────
    // Tool icon SVG paths
    // ──────────────────────────────────
    const toolIcons: Record<ToolType, string> = {
        select: 'M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59',
        text: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12',
        draw: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42',
        shape: 'M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z',
        highlight: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42',
        eraser: 'M5.25 7.5l7.5-7.5 7.5 7.5-7.5 7.5-7.5-7.5z',
        image: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z',
    };

    const toolLabels: Record<ToolType, string> = {
        select: 'Select', text: 'Text', draw: 'Draw', shape: 'Shape',
        highlight: 'Highlight', eraser: 'Eraser', image: 'Image',
    };

    // ──────────────────────────────────
    // UPLOAD VIEW
    // ──────────────────────────────────
    if (!selectedFile) {
        return (
            <div className="detail-view animate-fade-in">
                <div className="container">
                    <BackButton onBack={onBack} />

                    <div className="workspace-card">
                        <div className="workspace-header">
                            <div className="workspace-icon-large">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                    <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                                </svg>
                            </div>
                            <h1 className="workspace-title">{tool.name}</h1>
                            <p className="workspace-desc">{tool.description}</p>
                        </div>

                        <div className="workspace-body">
                            {errorMsg && (
                                <div className="error-msg">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20, flexShrink: 0 }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                    </svg>
                                    <span>{errorMsg}</span>
                                    <button onClick={() => setErrorMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}>
                                        Dismiss
                                    </button>
                                </div>
                            )}

                            {loading ? (
                                <div className="result-area" style={{ padding: '3rem 0' }}>
                                    <div style={{ maxWidth: '200px', margin: '0 auto 2rem' }}>
                                        <div className="loader"><div className="loader-bar"></div></div>
                                    </div>
                                    <h3 className="workspace-title" style={{ fontSize: '1.5rem' }}>Loading PDF...</h3>
                                    <p className="workspace-desc">Preparing your document for editing</p>
                                </div>
                            ) : (
                                <div
                                    className={`upload-zone ${isDragging ? 'drag-over' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        style={{ display: 'none' }}
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept=".pdf,application/pdf"
                                    />
                                    <div className="file-preview" style={{ cursor: 'pointer' }}>
                                        <div className="upload-icon-wrapper">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-lg">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                            Drop your PDF here
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                                            or click to browse (max 50 MB)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="workspace-footer">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="icon-sm">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            All processing happens in your browser. No uploads required.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────
    // EDITOR VIEW
    // ──────────────────────────────────
    const currentDetected = detectedTexts.get(currentPage) || [];

    return (
        <div className="pdf-editor">
            {/* Header */}
            <div className="editor-header">
                <div className="editor-header-left">
                    <button
                        className="editor-btn"
                        onClick={() => {
                            if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Are you sure you want to leave?')) return;
                            onBack();
                        }}
                        title="Back to Dashboard"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <span className="editor-filename">{selectedFile.name}</span>
                    <span className="editor-page-badge">
                        {currentPage} / {totalPages}
                    </span>
                </div>

                <div className="editor-header-center">
                    <button
                        className="editor-btn"
                        onClick={undo}
                        disabled={historyIndex < 0}
                        title="Undo (Ctrl+Z)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    </button>
                    <button
                        className="editor-btn"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        title="Redo (Ctrl+Y)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                    </button>
                </div>

                <div className="editor-header-right">
                    <button
                        className="editor-btn editor-btn-save"
                        onClick={handleSave}
                        disabled={saving}
                        title="Save (Ctrl+S)"
                    >
                        {saving ? (
                            <>
                                <div className="editor-spinner"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Save PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main body */}
            <div className="editor-body">
                {/* Left sidebar — page thumbnails */}
                <div className="page-sidebar">
                    <div className="page-sidebar-header">Pages</div>
                    <div className="page-sidebar-list">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <div
                                key={page}
                                className={`page-thumb ${currentPage === page ? 'active' : ''}`}
                                onClick={() => goToPage(page)}
                            >
                                <div className="page-thumb-inner">
                                    {page}
                                </div>
                                <span className="page-thumb-label">Page {page}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center — canvas area */}
                <div className="canvas-area" ref={canvasContainerRef}>
                    {pageLoading && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.6)', zIndex: 20, pointerEvents: 'none',
                        }}>
                            <div className="editor-spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: 'var(--border-color)', borderTopColor: 'var(--text-primary)' }} />
                        </div>
                    )}
                    <div className="canvas-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
                        <canvas
                            ref={canvasRef}
                            className="editor-canvas"
                            style={{
                                cursor: toolMode === 'select' ? 'default' :
                                    toolMode === 'text' ? 'text' :
                                    toolMode === 'draw' ? 'crosshair' :
                                    toolMode === 'eraser' ? 'cell' : 'crosshair'
                            }}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={() => {
                                if (isInteracting) {
                                    // Save drawing in progress instead of discarding
                                    if (toolMode === 'draw' && currentDrawingPoints.length > 1) {
                                        const points = [...currentDrawingPoints];
                                        const newDrawing: DrawingPath = {
                                            id: `draw-${Date.now()}`,
                                            pageNumber: currentPage,
                                            points,
                                            color: drawSettings.color,
                                            width: drawSettings.width,
                                        };
                                        pushCommand({
                                            description: 'Add drawing',
                                            execute: () => setEditorState(s => ({ ...s, drawings: [...s.drawings, newDrawing] })),
                                            undo: () => setEditorState(s => ({ ...s, drawings: s.drawings.filter(d => d.id !== newDrawing.id) })),
                                        });
                                    }
                                    setIsInteracting(false);
                                    setInteractionStart(null);
                                    setCurrentDrawingPoints([]);
                                    setPreviewShape(null);
                                    setMovingElement(null);
                                }
                            }}
                            onTouchStart={(e) => { if (toolMode !== 'select' && toolMode !== 'text') e.preventDefault(); handleCanvasMouseDown(e); }}
                            onTouchMove={(e) => { if (isInteracting) e.preventDefault(); handleCanvasMouseMove(e); }}
                            onTouchEnd={(e) => { handleCanvasMouseUp(e); }}
                        />

                        {/* Text detection overlay */}
                        <div className="text-detection-layer" style={getOverlayStyle()} ref={editOverlayRef}>
                            {toolMode !== 'draw' && toolMode !== 'eraser' && toolMode !== 'shape' && toolMode !== 'highlight' && currentDetected.map(item => {
                                const canvas = canvasRef.current;
                                if (!canvas) return null;
                                const scaleX = canvas.clientWidth / canvas.width;
                                const scaleY = canvas.clientHeight / canvas.height;

                                // Skip if this text was edited (whiteout exists for it)
                                const wasEdited = editorState.whiteouts.some(w =>
                                    w.pageNumber === currentPage &&
                                    Math.abs(w.x - (item.x - 2)) < 5 &&
                                    Math.abs(w.y - (item.y - 2)) < 5
                                );
                                if (wasEdited) return null;
                                if (editingTextId === item.id) return null;

                                return (
                                    <div
                                        key={item.id}
                                        className="detected-text-span"
                                        style={{
                                            position: 'absolute',
                                            left: item.x * scaleX,
                                            top: item.y * scaleY,
                                            width: item.width * scaleX,
                                            height: item.height * scaleY,
                                            pointerEvents: 'auto',
                                            cursor: 'text',
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDetectedTextClick(item);
                                        }}
                                        title={`Click to edit: "${item.text}"`}
                                    />
                                );
                            })}
                        </div>

                        {/* Inline text editing overlay for detected text */}
                        {editingTextId && editingTextPos && (() => {
                            const canvas = canvasRef.current;
                            if (!canvas) return null;
                            const scaleX = canvas.clientWidth / canvas.width;
                            const scaleY = canvas.clientHeight / canvas.height;
                            return (
                                <textarea
                                    ref={inlineInputRef}
                                    className="inline-text-editor"
                                    style={{
                                        position: 'absolute',
                                        left: editingTextPos.x * scaleX,
                                        top: editingTextPos.y * scaleY,
                                        fontSize: editingTextPos.fontSize * scaleY,
                                        fontFamily: editingTextPos.fontFamily,
                                        color: editingTextPos.color,
                                        minWidth: 100,
                                        minHeight: editingTextPos.fontSize * scaleY + 4,
                                    }}
                                    value={editingTextValue}
                                    onChange={(e) => setEditingTextValue(e.target.value)}
                                    onBlur={commitTextEdit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
                                        if (e.key === 'Escape') { setEditingTextId(null); setEditingTextPos(null); }
                                    }}
                                />
                            );
                        })()}

                        {/* Inline text editor for new text */}
                        {newTextPos && (() => {
                            const canvas = canvasRef.current;
                            if (!canvas) return null;
                            const scaleX = canvas.clientWidth / canvas.width;
                            const scaleY = canvas.clientHeight / canvas.height;
                            return (
                                <textarea
                                    ref={inlineInputRef}
                                    className="inline-text-editor"
                                    style={{
                                        position: 'absolute',
                                        left: newTextPos.x * scaleX,
                                        top: newTextPos.y * scaleY,
                                        fontSize: textSettings.fontSize * scale * scaleY,
                                        fontFamily: textSettings.fontFamily,
                                        color: textSettings.color,
                                        minWidth: 120,
                                        minHeight: textSettings.fontSize * scale * scaleY + 4,
                                    }}
                                    value={editingTextValue}
                                    onChange={(e) => setEditingTextValue(e.target.value)}
                                    onBlur={commitNewText}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNewText(); }
                                        if (e.key === 'Escape') { setNewTextPos(null); setEditingTextValue(''); }
                                    }}
                                    placeholder="Type here..."
                                />
                            );
                        })()}

                        {/* Image overlays */}
                        {editorState.images.filter(i => i.pageNumber === currentPage).map(img => {
                            const canvas = canvasRef.current;
                            if (!canvas) return null;
                            const scaleX = canvas.clientWidth / canvas.width;
                            const scaleY = canvas.clientHeight / canvas.height;
                            return (
                                <img
                                    key={img.id}
                                    src={img.imageData}
                                    alt="Inserted"
                                    className={`editor-image-overlay ${selectedElementId === img.id ? 'selected' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        left: img.x * scaleX,
                                        top: img.y * scaleY,
                                        width: img.width * scaleX,
                                        height: img.height * scaleY,
                                        opacity: img.opacity,
                                        transform: `rotate(${img.rotation}deg)`,
                                        pointerEvents: toolMode === 'select' ? 'auto' : 'none',
                                        cursor: 'move',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedElementId(img.id);
                                    }}
                                    draggable={false}
                                />
                            );
                        })}

                        {/* Text element overlays for visual rendering */}
                        {editorState.texts.filter(t => t.pageNumber === currentPage).map(t => {
                            const canvas = canvasRef.current;
                            if (!canvas) return null;
                            const scaleX = canvas.clientWidth / canvas.width;
                            const scaleY = canvas.clientHeight / canvas.height;
                            return (
                                <div
                                    key={t.id}
                                    className={`editor-text-overlay ${selectedElementId === t.id ? 'selected' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        left: t.x * scaleX,
                                        top: t.y * scaleY,
                                        fontSize: t.fontSize * scaleY,
                                        fontFamily: t.fontFamily,
                                        color: t.color,
                                        pointerEvents: toolMode === 'select' ? 'auto' : 'none',
                                        cursor: 'move',
                                        whiteSpace: 'pre',
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedElementId(t.id); }}
                                >
                                    {t.text}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right sidebar — tool panel */}
                <div className="tool-panel">
                    <div className="tool-panel-section">
                        <div className="tool-panel-label">Tools</div>
                        <div className="tool-grid">
                            {(Object.keys(toolIcons) as ToolType[]).map(t => (
                                <button
                                    key={t}
                                    className={`tool-btn-editor ${toolMode === t ? 'active' : ''}`}
                                    onClick={() => {
                                        if (t === 'image') {
                                            imageUploadRef.current?.click();
                                        }
                                        setToolMode(t);
                                        setSelectedElementId(null);
                                    }}
                                    title={toolLabels[t]}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d={toolIcons[t]} />
                                    </svg>
                                    <span>{toolLabels[t]}</span>
                                </button>
                            ))}
                        </div>
                        <input
                            ref={imageUploadRef}
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Contextual settings */}
                    {toolMode === 'text' && (
                        <div className="tool-panel-section">
                            <div className="tool-panel-label">Text Settings</div>
                            <select
                                value={textSettings.fontFamily}
                                onChange={e => setTextSettings(s => ({ ...s, fontFamily: e.target.value }))}
                                className="tool-select"
                            >
                                <option value="Helvetica">Helvetica</option>
                                <option value="Courier">Courier</option>
                                <option value="Times New Roman">Times Roman</option>
                            </select>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <input
                                    type="number"
                                    value={textSettings.fontSize}
                                    onChange={e => setTextSettings(s => ({ ...s, fontSize: parseInt(e.target.value) || 16 }))}
                                    min={8} max={72}
                                    className="tool-input"
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="color"
                                    value={textSettings.color}
                                    onChange={e => setTextSettings(s => ({ ...s, color: e.target.value }))}
                                    className="tool-color"
                                />
                            </div>
                        </div>
                    )}

                    {toolMode === 'draw' && (
                        <div className="tool-panel-section">
                            <div className="tool-panel-label">Draw Settings</div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={drawSettings.color}
                                    onChange={e => setDrawSettings(s => ({ ...s, color: e.target.value }))}
                                    className="tool-color"
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{drawSettings.width}px</span>
                            </div>
                            <input
                                type="range"
                                value={drawSettings.width}
                                onChange={e => setDrawSettings(s => ({ ...s, width: parseInt(e.target.value) }))}
                                min={1} max={20}
                                className="tool-range"
                            />
                        </div>
                    )}

                    {toolMode === 'shape' && (
                        <div className="tool-panel-section">
                            <div className="tool-panel-label">Shape Settings</div>
                            <select
                                value={shapeSettings.type}
                                onChange={e => setShapeSettings(s => ({ ...s, type: e.target.value as any }))}
                                className="tool-select"
                            >
                                <option value="rectangle">Rectangle</option>
                                <option value="circle">Circle</option>
                                <option value="line">Line</option>
                            </select>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Stroke</label>
                                <input
                                    type="color"
                                    value={shapeSettings.color}
                                    onChange={e => setShapeSettings(s => ({ ...s, color: e.target.value }))}
                                    className="tool-color"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Fill</label>
                                {shapeSettings.fillColor ? (
                                    <input
                                        type="color"
                                        value={shapeSettings.fillColor}
                                        onChange={e => setShapeSettings(s => ({ ...s, fillColor: e.target.value }))}
                                        className="tool-color"
                                    />
                                ) : (
                                    <button
                                        className="editor-btn"
                                        style={{ fontSize: '0.7rem', padding: '2px 6px', border: '1px dashed var(--border-color)' }}
                                        onClick={() => setShapeSettings(s => ({ ...s, fillColor: '#ffffff' }))}
                                        title="Click to add fill color"
                                    >
                                        None
                                    </button>
                                )}
                                {shapeSettings.fillColor && (
                                    <button
                                        className="editor-btn"
                                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                        onClick={() => setShapeSettings(s => ({ ...s, fillColor: '' }))}
                                    >
                                        No fill
                                    </button>
                                )}
                            </div>
                            <input
                                type="range"
                                value={shapeSettings.strokeWidth}
                                onChange={e => setShapeSettings(s => ({ ...s, strokeWidth: parseInt(e.target.value) }))}
                                min={1} max={10}
                                className="tool-range"
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Width: {shapeSettings.strokeWidth}px</span>
                        </div>
                    )}

                    {toolMode === 'highlight' && (
                        <div className="tool-panel-section">
                            <div className="tool-panel-label">Highlight Color</div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {['#FFFF00', '#00FF00', '#FF69B4', '#00BFFF', '#FFA500'].map(c => (
                                    <button
                                        key={c}
                                        className={`highlight-swatch ${highlightColor === c ? 'active' : ''}`}
                                        style={{ background: c }}
                                        onClick={() => setHighlightColor(c)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {toolMode === 'eraser' && (
                        <div className="tool-panel-section">
                            <div className="tool-panel-label">Eraser</div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: 0 }}>
                                Click and drag on the canvas to erase (whiteout) areas of the PDF.
                            </p>
                        </div>
                    )}

                    {/* Page navigation */}
                    <div className="tool-panel-section">
                        <div className="tool-panel-label">Navigation</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                className="editor-btn"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                className="editor-btn"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Zoom */}
                    <div className="tool-panel-section">
                        <div className="tool-panel-label">Zoom</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button className="editor-btn" onClick={() => handleZoom(-25)} disabled={zoom <= 50}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                                </svg>
                            </button>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, minWidth: 40, textAlign: 'center', color: 'var(--text-primary)' }}>{zoom}%</span>
                            <button className="editor-btn" onClick={() => handleZoom(25)} disabled={zoom >= 200}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16, height: 16 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Info tip */}
                    <div className="tool-panel-section" style={{ marginTop: 'auto' }}>
                        <div style={{
                            padding: '0.75rem',
                            background: 'var(--info-bg)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5,
                        }}>
                            <strong>Tip:</strong> Hover over existing text and click to edit it in-place. Use Ctrl+Z to undo, Ctrl+S to save.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditPDF;
