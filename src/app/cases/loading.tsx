export default function LoadingCases() {
  return (
    <div className="min-h-screen">
      <main className="page-shell py-10">
        <div className="h-4 w-24 animate-pulse rounded bg-[#e7e0d2]" />
        <div className="mt-4 h-9 w-64 animate-pulse rounded bg-[#e7e0d2]" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="card card-pad">
              <div className="h-3 w-20 animate-pulse rounded bg-[#eee8dc]" />
              <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-[#e7e0d2]" />
              <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-[#eee8dc]" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
