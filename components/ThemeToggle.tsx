'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle({ className }: { className?: string }) {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`ux-icon-button ${className || ''}`}
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
            {theme === 'dark' ? (
                <Sun size={17} className="text-yellow-400" />
            ) : (
                <Moon size={17} className="text-gray-400" />
            )}
        </button>
    )
}
