interface WarningBannerProps {
  warnings: string[];
  visible: boolean;
}

type WarningMeta = {
  icon: string;
  title: string;
  accentClass: string;
  chipLabel?: string;
};

type ShopLink = {
  label: string;
  site: string;
  url: string;
};

function buildShopLinks(query: string): ShopLink[] {
  const encoded = encodeURIComponent(query);
  return [
    {
      label: "Browse ASOS",
      site: "ASOS",
      url: `https://www.asos.com/search/?q=${encoded}`,
    },
    {
      label: "Browse H&M",
      site: "H&M",
      url: `https://www2.hm.com/en_us/search-results.html?q=${encoded}`,
    },
    {
      label: "Browse Zara",
      site: "Zara",
      url: `https://www.zara.com/us/en/search?searchTerm=${encoded}`,
    },
  ];
}

function getWarningMeta(warning: string): WarningMeta {
  const normalized = warning.toLowerCase();

  if (normalized.includes("rain")) {
    return {
      icon: "🌧️",
      title: "Rain coverage needed",
      accentClass: "border-sky-200 bg-sky-50 text-sky-900",
      chipLabel: "Weather gap",
    };
  }

  if (normalized.includes("cold") || normalized.includes("boots") || normalized.includes("warmer coat")) {
    return {
      icon: "🧥",
      title: "Cold-weather gap",
      accentClass: "border-indigo-200 bg-indigo-50 text-indigo-900",
      chipLabel: "Warmth needed",
    };
  }

  if (normalized.includes("top variety") || normalized.includes("top option")) {
    return {
      icon: "👕",
      title: "Top rotation is limited",
      accentClass: "border-violet-200 bg-violet-50 text-violet-900",
      chipLabel: "Variety",
    };
  }

  if (normalized.includes("bottom variety") || normalized.includes("bottom option")) {
    return {
      icon: "👖",
      title: "Bottom rotation is limited",
      accentClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
      chipLabel: "Variety",
    };
  }

  if (normalized.includes("affected days") || normalized.includes("not be suitable")) {
    return {
      icon: "⚠️",
      title: "Forecast risk detected",
      accentClass: "border-amber-200 bg-amber-50 text-amber-900",
      chipLabel: "Heads up",
    };
  }

  return {
    icon: "💡",
    title: "Wardrobe tip",
    accentClass: "border-slate-200 bg-slate-50 text-slate-900",
    chipLabel: "Suggestion",
  };
}

function getShoppingLinksForWarnings(warnings: string[]): { heading: string; links: ShopLink[] } | null {
  const allText = warnings.join(" ").toLowerCase();

  if (allText.includes("rain")) {
    return {
      heading: "Need rain-ready pieces? These links open rain jackets and waterproof layers.",
      links: buildShopLinks("rain jacket waterproof coat"),
    };
  }

  if (allText.includes("cold") || allText.includes("boots") || allText.includes("warmer coat")) {
    return {
      heading: "Need warmer coverage? These links open coats and boots for colder days.",
      links: buildShopLinks("winter coat boots"),
    };
  }

  if (allText.includes("bottom variety") || allText.includes("bottom option")) {
    return {
      heading: "Need more bottoms? These links open pants, jeans, and similar options.",
      links: buildShopLinks("pants jeans bottoms"),
    };
  }

  if (allText.includes("top variety") || allText.includes("top option")) {
    return {
      heading: "Need more tops? These links open shirts, tops, and sweaters.",
      links: buildShopLinks("tops shirts sweaters"),
    };
  }

  return {
    heading: "Want to expand your wardrobe? These links open general wardrobe essentials.",
    links: buildShopLinks("wardrobe essentials basics"),
  };
}

export default function WarningBanner({ warnings, visible }: WarningBannerProps) {
  if (!visible || warnings.length === 0) {
    return null;
  }

  const shoppingLinks = getShoppingLinksForWarnings(warnings);

  return (
    <div className="rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">⚠️</div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-amber-950">Wardrobe guidance</h3>
              <span className="rounded-full border border-amber-300 bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                {warnings.length} alert{warnings.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-amber-900/80">
              Your forecast is still available, but these tips can improve outfit quality and coverage.
            </p>
          </div>
        </div>

        {shoppingLinks && (
          <div className="rounded-2xl border border-amber-200 bg-white/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Helpful shopping links</p>
            <p className="mt-1 text-sm text-amber-900/80">{shoppingLinks.heading}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {shoppingLinks.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-emerald-900">{link.site}</p>
                      <p className="mt-1 text-xs text-emerald-800">{link.label}</p>
                    </div>
                    <span className="text-sm text-emerald-700 transition group-hover:translate-x-0.5">↗</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {warnings.map((warning, idx) => {
            const meta = getWarningMeta(warning);
            return (
              <div key={idx} className={`rounded-2xl border p-4 shadow-sm md:col-span-2 ${meta.accentClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{meta.title}</p>
                      <p className="mt-1 text-sm leading-relaxed opacity-90">{warning}</p>
                    </div>
                  </div>
                  {meta.chipLabel && (
                    <span className="rounded-full border border-current/15 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      {meta.chipLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
