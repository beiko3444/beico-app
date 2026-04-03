'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextType = {
    theme: Theme
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'light',
    toggleTheme: () => {},
})

export function useTheme() {
    return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem('beico-theme') as Theme | null
        const initial = stored || 'light'
        setTheme(initial)
        document.documentElement.classList.toggle('dark', initial === 'dark')
        setMounted(true)
    }, [])

    function toggleTheme() {
        const next = theme === 'light' ? 'dark' : 'light'
        setTheme(next)
        localStorage.setItem('beico-theme', next)
        document.documentElement.classList.toggle('dark', next === 'dark')
    }

    if (!mounted) return <>{children}</>

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
