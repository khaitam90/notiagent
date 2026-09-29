type Props = {
  variant?: 'sidebar' | 'mobile'
}

/** Credit nhà sáng tạo — hiển thị trên mọi trang qua Layout. */
export function CreatorCredit({ variant = 'sidebar' }: Props) {
  return (
    <p className={`creator-credit creator-credit--${variant}`} aria-label="Thông tin nhà sáng tạo">
      <span className="creator-credit-dot" aria-hidden />
      Sản phẩm thuộc về nhà sáng tạo{' '}
      <span className="creator-credit-name">AI Quốc Hưng</span>
    </p>
  )
}
