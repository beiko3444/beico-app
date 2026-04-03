'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle({ className }: { className?: string }) {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${className || ''}`}
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        >
            {theme === 'dark' ? (
                <Sun size={17} className="text-yellow-400" />
            ) : (
                <Moon size={17} className="text-gray-400" />
            )}
        </button>
    )
}
