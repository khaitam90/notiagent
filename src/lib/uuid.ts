/**
 * Sinh ID duy nhất an toàn ở mọi ngữ cảnh trình duyệt.
 * 2026-07-26: crypto.randomUUID() chỉ tồn tại trong "secure context" (HTTPS/localhost).
 * Nếu trang bị mở qua HTTP thường (hoặc trình duyệt cũ), crypto.randomUUID là undefined
 * -> mọi nút "Tạo..." (workflow, node, thư mục, chat, asset...) ném lỗi ngay khi bấm,
 * không có thông báo gì, nhìn như nút "vô tác dụng". Dùng hàm này thay thế trực tiếp
 * crypto.randomUUID() ở MỌI nơi trong code để tránh crash, không phụ thuộc secure context.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // rơi xuống fallback nếu vì lý do gì đó vẫn throw
    }
  }
  // Fallback UUID v4 thủ công, không cần Web Crypto API.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
