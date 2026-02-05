/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DragDropReorder Component
 * Allows users to reorder items (images/PDF pages) via drag and drop
 * Production-ready for millions of users
 */

import React, { useState, useRef, DragEvent } from 'react';

interface DraggableItem {
  id: string;
  preview?: string;
  name: string;
}

interface DragDropReorderProps {
  items: DraggableItem[];
  onReorder: (newOrder: string[]) => void;
  renderItem?: (item: DraggableItem, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}

export const DragDropReorder: React.FC<DragDropReorderProps> = ({
  items,
  onReorder,
  renderItem,
  className = '',
  itemClassName = '',
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [orderedItems, setOrderedItems] = useState(items);

  // Update when items prop changes
  React.useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);

    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // Reorder items
    const newItems = [...orderedItems];
    const draggedItem = newItems[draggedIndex];

    // Remove from old position
    newItems.splice(draggedIndex, 1);

    // Insert at new position
    newItems.splice(dropIndex, 0, draggedItem);

    setOrderedItems(newItems);
    onReorder(newItems.map(item => item.id));
    setDragOverIndex(null);
  };

  const moveItem = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

    if (toIndex < 0 || toIndex >= orderedItems.length) return;

    const newItems = [...orderedItems];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);

    setOrderedItems(newItems);
    onReorder(newItems.map(item => item.id));
  };

  const defaultRenderItem = (item: DraggableItem, index: number) => (
    <div style={{ padding: '12px', textAlign: 'center' }}>
      {item.preview && (
        <img
          src={item.preview}
          alt={item.name}
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '4px',
            marginBottom: '8px',
          }}
        />
      )}
      <div style={{
        fontSize: '12px',
        color: '#666',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {index + 1}. {item.name}
      </div>
    </div>
  );

  return (
    <div
      className={`drag-drop-reorder ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '12px',
        padding: '16px',
      }}
    >
      {orderedItems.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`draggable-item ${itemClassName}`}
          style={{
            position: 'relative',
            border: dragOverIndex === index ? '2px dashed #4CAF50' : '2px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: draggedIndex === index ? '#f5f5f5' : '#fff',
            cursor: 'grab',
            transition: 'all 0.2s ease',
            userSelect: 'none',
          }}
        >
          {/* Drag handle indicator */}
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              fontSize: '18px',
              color: '#999',
              cursor: 'grab',
            }}
            title="Drag to reorder"
          >
            ⋮⋮
          </div>

          {/* Arrow buttons for keyboard/touch users */}
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              gap: '4px',
            }}
          >
            {index > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveItem(index, 'up');
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#f0f0f0',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Move up"
              >
                ↑
              </button>
            )}
            {index < orderedItems.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  moveItem(index, 'down');
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#f0f0f0',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Move down"
              >
                ↓
              </button>
            )}
          </div>

          {/* Item content */}
          {renderItem ? renderItem(item, index) : defaultRenderItem(item, index)}
        </div>
      ))}
    </div>
  );
};
