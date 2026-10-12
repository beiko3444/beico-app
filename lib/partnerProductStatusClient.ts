import type { PartnerProductStatus } from './partnerProductStatus'

export async function savePartnerProductStatus(
    id: string, status: PartnerProductStatus, request: typeof fetch = fetch,
): Promise<{ id: string, partnerSaleStatus: PartnerProductStatus, wholesaleAvailable: boolean }> {
    // One retry is safe: saving a status is idempotent.
    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        try {
            const response = await request(`/api/products/${encodeURIComponent(id)}/partner-status`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerSaleStatus: status }), signal: controller.signal,
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                if (attempt === 0 && [502, 503, 504].includes(response.status)) continue
                if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인한 뒤 변경해 주세요.')
                if (response.status === 403) throw new Error('관리자 권한이 필요합니다. 관리자 계정으로 다시 로그인해 주세요.')
                throw new Error(data?.error || `노출상태를 저장하지 못했습니다. (HTTP ${response.status})`)
            }
            if (data?.id !== id || data?.partnerSaleStatus !== status || data?.wholesaleAvailable !== (status === 'VISIBLE')) {
                throw new Error('저장 결과를 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.')
            }
            return data
        } catch (error) {
            if (error instanceof TypeError || controller.signal.aborted) {
                if (attempt === 0) continue
                throw new Error('네트워크 연결 또는 서버 응답이 지연됩니다. 새로고침 후 상태를 확인해 주세요.')
            }
            throw error
        } finally { clearTimeout(timeout) }
    }
    throw new Error('노출상태를 저장하지 못했습니다.')
}
