export default function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-800">{value}</h3>
        </div>

        {Icon && (
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
            <Icon size={22} />
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}