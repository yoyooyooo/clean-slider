
export interface CropMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type MaskFillType = 'solid' | 'clone-top' | 'clone-bottom' | 'clone-left' | 'clone-right';

export interface Mask {
  id: string;
  x: number;      // percentage 0-100, from left
  y: number;      // percentage 0-100, from top
  width: number;  // percentage 0-100
  height: number; // percentage 0-100
  color: string;  // Hex code of the background color to fill (used for solid)
  fillType: MaskFillType; // Strategy to fill the mask
  imageSnapshot?: string; // Base64 png string of the texture to use for cloning
  pageIndex?: number; // 0-based index. If undefined, applies to all pages.
}

export type EditMode = 'CROP' | 'MASK';

export interface PdfDimensions {
  width: number;
  height: number;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  READY = 'READY',
  PROCESSING = 'PROCESSING',
  ANALYZING = 'ANALYZING',
}

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
}
