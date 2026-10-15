import React, { useState } from 'react'

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23f5f5f5'/><text y='65' x='35' font-size='45' font-weight='bold' fill='%23ea580c'>S</text></svg>"

interface ProductImageProps {
  src?: string | null
  fallbackSrc?: string
  alt: string
  className?: string
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className,
}) => {
  const sourceKey = `${src || ''}\u0000${fallbackSrc || ''}`
  const [imageFailures, setImageFailures] = useState<{ sourceKey: string; failed: string[] }>({
    sourceKey: '',
    failed: [],
  })
  const failedImages = imageFailures.sourceKey === sourceKey ? imageFailures.failed : []
  const candidates = [src, fallbackSrc, PLACEHOLDER_IMAGE]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index)
  const current = candidates.find((candidate) => !failedImages.includes(candidate)) || PLACEHOLDER_IMAGE

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => setImageFailures((state) => ({
        sourceKey,
        failed: [...(state.sourceKey === sourceKey ? state.failed : []), current],
      }))}
    />
  )
}
