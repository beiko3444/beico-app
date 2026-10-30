'use client'

import { X } from 'lucide-react'
import { buttonClass } from './buttonClass'

/** The one close button for dialogs and drawers: 36px ghost square with a 20px X. */
export default function ModalCloseButton({ onClick, label = '닫기', className = '' }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={buttonClass('ghost', 'iconMd', `text-slate-500 hover:text-slate-900 ${className}`)}>
      <X size={20} aria-hidden="true" />
    </button>
  )
}
