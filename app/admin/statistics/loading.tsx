export default function StatisticsLoading() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] -mx-4 px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="border border-slate-200 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="max-w-[860px] space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-72 max-w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-[520px] max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </section>

        <section className="border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
              <div className="ml-auto h-9 w-20 animate-pulse rounded-xl bg-blue-100" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-[82px] animate-pulse border border-slate-200 bg-white shadow-sm" />
          ))}
        </section>

        <section className="h-[420px] animate-pulse border border-slate-200 bg-white shadow-sm" />
      </div>
    </div>
  )
}
