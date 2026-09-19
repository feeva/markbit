export type Tool = 'select' | 'crop' | 'rectangle' | 'text' | 'marker' | 'pencil' | 'blur'

export interface ToolSettings {
  lineWidth: number
  lineColor: string
}

export interface AnnotationImageMeta {
  width: number
  height: number
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImagePlacement {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface RectangleAnnotation {
  id: string
  type: 'rectangle'
  x: number
  y: number
  width: number
  height: number
  stroke: string
  strokeWidth: number
  rotation?: number
}

export interface TextAnnotation {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
  color: string
  fontSize: number
  fontFamily: string
  rotation?: number
}

export interface MarkerAnnotation {
  id: string
  type: 'marker'
  points: number[]
  color: string
  width: number
  opacity: number
  rotation?: number
}

export interface PencilAnnotation {
  id: string
  type: 'pencil'
  points: number[]
  color: string
  width: number
  rotation?: number
}

export interface BlurAnnotation {
  id: string
  type: 'blur'
  x: number
  y: number
  width: number
  height: number
  pixelSize: number
  rotation?: number
}

export type AnnotationItem =
  | RectangleAnnotation
  | TextAnnotation
  | MarkerAnnotation
  | PencilAnnotation
  | BlurAnnotation

export interface AnnotationDocument {
  version: 1
  image: AnnotationImageMeta
  crop: CropRect | null
  imagePlacement?: ImagePlacement
  items: AnnotationItem[]
}

export interface AnnotationSavePayload {
  annotationData: string
  previewDataUrl: string
}

export interface DraftAttachmentBase {
  id: number
  file: File
}

export interface DraftImageAttachment extends DraftAttachmentBase {
  kind: 'image'
  previewUrl: string
  annotationData?: AnnotationDocument
  annotationPreviewDataUrl?: string
}

export interface DraftFileAttachment extends DraftAttachmentBase {
  kind: 'file'
}

export type DraftAttachment = DraftImageAttachment | DraftFileAttachment
