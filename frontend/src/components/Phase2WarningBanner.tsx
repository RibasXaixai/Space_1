interface WarningBannerProps {
  warnings: string[];
  visible: boolean;
}

export default function WarningBanner({ warnings, visible }: WarningBannerProps) {
  if (!visible || warnings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm">
      <div className="flex gap-4">
        <div className="text-2xl flex-shrink-0">⚠️</div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">Important wardrobe alerts</h3>
          <ul className="mt-3 space-y-2">
            {warnings.map((warning, idx) => (
              <li key={idx} className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-900">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
