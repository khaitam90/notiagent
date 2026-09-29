/** Phạm vi dự án đang mở — gắn tag upload/sản phẩm khi ở Studio trong dự án */
let activeScope: string | null = null

export function setStudioProjectScope(projectId: string | null) {
  activeScope = projectId
}

export function getStudioProjectScope(): string | null {
  return activeScope
}
