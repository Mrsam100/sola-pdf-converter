/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'PDF' | 'Image' | 'Text' | 'Security';
  icon: string; // SVG path
}

export type ViewState = 
  | { type: 'home' }
  | { type: 'dashboard' } // The grid view
  | { type: 'tool', tool: Tool };

export enum ProcessState {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  CONVERTING = 'converting',
  COMPLETED = 'completed'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  imageUrl: string;
  features: string[];
}

export interface JournalArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image: string;
}
