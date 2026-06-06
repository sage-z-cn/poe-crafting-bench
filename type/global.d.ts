
interface ExecParam {
    path: string
    platform?: 'TENCENT' | 'GGG'
    patch?: string[]
    font?: string
    fontSizeDelta?: number
    removeFog?: boolean
    minimapVisibility?: boolean
    cameraZoom?: number
    lightUp?: number
}