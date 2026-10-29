'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { buttonClass } from '@/components/ui/buttonClass'

type Details = { name: string; contact: string; email: string; fax: string; address: string }

export default function PartnerProfileForm({ initial, isKorean }: { initial: Details; isKorean: boolean }) {
    const router = useRouter()
    const [values, setValues] = useState(initial)
    const [saved, setSaved] = useState(initial)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<{ text: string; failed: boolean }>({ text: '', failed: false })
    const dirty = JSON.stringify(values) !== JSON.stringify(saved)
    const fields = [
        { key: 'name', label: isKorean ? '담당자명' : '担当者名', max: 100, type: 'text', auto: 'name' },
        { key: 'contact', label: isKorean ? '연락처' : '電話番号', max: 60, type: 'tel', auto: 'tel' },
        { key: 'email', label: isKorean ? '연락용 이메일' : '連絡先メール', max: 254, type: 'email', auto: 'email' },
        { key: 'fax', label: isKorean ? '팩스 (선택)' : 'FAX（任意）', max: 60, type: 'tel', auto: 'off' },
        { key: 'address', label: isKorean ? '사업장·배송 주소' : '事業所・配送先住所', max: 500, type: 'text', auto: 'street-address' },
    ] as const
    const statusText = message.text || (dirty ? (isKorean ? '저장하지 않은 변경사항이 있습니다.' : '未保存の変更があります。') : '')
    return <form className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7" onSubmit={async event => {
        event.preventDefault()
        if (busy || !dirty) return
        setBusy(true)
        setMessage({ text: '', failed: false })
        try {
            const response = await fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
            if (!response.ok) throw new Error('save')
            setSaved(values)
            setMessage({ text: isKorean ? '정보를 저장했습니다.' : '保存しました。', failed: false })
            router.refresh()
        } catch { setMessage({ text: isKorean ? '저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.' : '保存できませんでした。入力内容をご確認の上、再度お試しください。', failed: true }) }
        finally { setBusy(false) }
    }}>
        <div className="space-y-1">
            <h2 className="text-xl font-bold">{isKorean ? '연락처 및 주소 수정' : '連絡先・住所の変更'}</h2>
            <p className="break-keep text-sm leading-6 text-[var(--muted-foreground)]">{isKorean ? '주소와 연락처는 관리자에게 공유되며 기존 거래명세서에도 반영됩니다. 진행 중인 주문의 배송지를 변경하려면 관리자에게도 알려주세요.' : '住所と連絡先は管理者に共有され、既存の取引明細書にも反映されます。進行中の注文の配送先変更は管理者にもお知らせください。'}</p>
        </div>
        <fieldset disabled={busy} className="mt-5 grid gap-5 sm:grid-cols-2">
            {fields.map(field => <label key={field.key} className={`block space-y-2 ${field.key === 'address' ? 'sm:col-span-2' : ''}`}>
                <span className="block text-sm font-semibold">
                    {field.label}
                    {field.key === 'name' ? <span aria-hidden className="ml-0.5 text-[var(--danger)]">*</span> : null}
                </span>
                <input className="ux-input h-12 text-base" type={field.type} autoComplete={field.auto} maxLength={field.max} required={field.key === 'name'} value={values[field.key]} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setMessage({ text: '', failed: false }) }} />
            </label>)}
        </fieldset>
        <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-sm ${message.failed ? 'text-[var(--danger)]' : 'text-[var(--muted-foreground)]'}`}>{statusText}</p>
        <div className="mt-3 flex flex-wrap gap-3">
            <button disabled={busy || !dirty} className={buttonClass('primary', 'md', 'min-h-11')} type="submit">{busy ? (isKorean ? '저장 중…' : '保存中…') : (isKorean ? '변경사항 저장' : '変更を保存')}</button>
            <button disabled={busy || !dirty} type="button" className={buttonClass('secondary', 'md', 'min-h-11')} onClick={() => { setValues(saved); setMessage({ text: '', failed: false }) }}>{isKorean ? '변경 취소' : '変更を取り消す'}</button>
        </div>
    </form>
}
