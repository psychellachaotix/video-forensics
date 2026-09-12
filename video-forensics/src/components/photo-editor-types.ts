export interface EditorState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
  sepia: number;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  exportFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  exportQuality: number;
}

export const defaultEditorState: EditorState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,
  exportFormat: 'image/jpeg',
  exportQuality: 90,
};
