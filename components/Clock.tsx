'use client'

import { useState, useEffect } from 'react'

export default function Clock() {
    const [time, setTime] = useState<Date | null>(null)

    useEffect(() => {
        setTime(new Date())
        const timer = setInterval(() => {
            setTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    if (!time) return null

    const formatJapaneseDate = (date: Date) => {
        const weekdays = ['日', '月', '火', '水', '木', '金', '土']
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const weekday = weekdays[date.getDay()]
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}年${month}月${day}日(${weekday}) ${hours}:${minutes}:${seconds}`
    }

    return (
        <div className="text-[11px] font-bold text-gray-800 tracking-widest">
            {formatJapaneseDate(time)}
        </div>
    )
}
