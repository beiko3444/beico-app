'use client'

import { useMemo } from 'react'
import type { CargoProxyDocument } from '@/lib/cargoDeliveryProxy'
import { buildCargoProxySheetMarkup } from '@/lib/cargoDeliveryProxySheet'

/**
 * 화면 미리보기용 위임장. 마크업은 lib/cargoDeliveryProxySheet.ts 에서 서버 PDF/팩스와 공유한다.
 * 스타일이 시트 안에 포함되어 있어 outerHTML 을 그대로 인쇄 iframe 에 복사할 수 있다.
 */
export function ProxySheet({
    doc,
    sealSrc = '/seal.png',
    logoSrc = '/logo.png',
}: {
    doc: CargoProxyDocument
    sealSrc?: string
    logoSrc?: string
}) {
    const html = useMemo(() => buildCargoProxySheetMarkup(doc, { sealSrc, logoSrc }), [doc, sealSrc, logoSrc])
    return <div dangerouslySetInnerHTML={{ __html: html }} />
}
