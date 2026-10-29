// No click-to-close on the background: it didn't look like a modal backdrop, so a stray tap closed the document.
export default function InvoiceWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--background)] pb-10 font-sans print:bg-white print:pb-0">
            {children}
        </div>
    )
}
