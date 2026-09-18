// Shown instantly on every admin navigation while the server renders the page.
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="불러오는 중">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="h-7 w-40 rounded-md bg-slate-200" />
          <div className="mt-2 h-3.5 w-72 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-slate-200" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="h-11 rounded-t-2xl bg-slate-100" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-slate-100 px-4 py-3">
            <div className="h-4 w-8 rounded bg-slate-100" />
            <div className="h-4 w-48 rounded bg-slate-100" />
            <div className="ml-auto h-4 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
