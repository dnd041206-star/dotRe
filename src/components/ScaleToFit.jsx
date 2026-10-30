import { useRef, useLayoutEffect, useState } from 'react'

/** 자식 콘텐츠가 담긴 박스보다 크면, 비율 그대로 줄여서 꽉 맞춤.
 *  스크롤 대신 축소 — PC에서 디자인한 레이아웃을 그대로 유지하면서
 *  화면이 작은 기기에서도 잘리지 않게 함. */
export default function ScaleToFit({ children }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const measure = () => {
      inner.style.transform = 'scale(1)'   // 원본 크기로 되돌려서 측정
      const outerH = outer.clientHeight
      const innerH = inner.scrollHeight
      const s = innerH > outerH && outerH > 0 ? outerH / innerH : 1
      setScale(s)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [children])

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={innerRef}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: '100%' }}
      >
        {children}
      </div>
    </div>
  )
}