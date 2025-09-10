import useEmblaCarousel from "embla-carousel-react";
import { useEffect } from "react";
import { RoleBadge } from "./RoleBadge";
import { createSmoothTiltHandlers } from "@/lib/tilt";
import { DEFAULT_AVATAR_IMG } from "@/lib/images";

export interface Seller {
  id: string;
  name: string;
  sales: number;
}

export default function TopSellersCarousel({ sellers }: { sellers: Seller[] }) {
  const [viewportRef, embla] = useEmblaCarousel({
    loop: true,
    align: "start",
    dragFree: true,
  });

  useEffect(() => {
    if (!embla) return;
    // Simple autoplay using scrollNext to ensure compatibility across embla versions
    const interval = setInterval(() => {
      if (!embla) return;
      try {
        if (
          typeof embla.canScrollNext === "function"
            ? embla.canScrollNext()
            : true
        ) {
          embla.scrollNext();
        } else {
          embla.scrollTo(0);
        }
      } catch (e) {
        // Fallback: if methods not available, do nothing
        // console.warn("Embla autoplay error:", e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [embla]);

  return (
    <div className="overflow-hidden" ref={viewportRef}>
      <div className="flex gap-4">
        {sellers.map((s) => (
          <div
            key={s.id}
            className="min-w-[240px] rounded-xl border border-border/60 bg-card/80 px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center gap-3">
              {(() => {
                const t = createSmoothTiltHandlers(8, 1.06);
                return (
                  <img
                    src={DEFAULT_AVATAR_IMG}
                    alt="avatar"
                    className="h-10 w-10 rounded-full object-cover"
                    {...t}
                  />
                );
              })()}
              <div className="flex-1">
                <div className="text-sm font-semibold leading-tight flex items-center gap-1">
                  {s.name}
                  <RoleBadge role="verified" className="h-4 w-4" />
                </div>
                <div className="text-xs text-foreground/70">
                  {s.sales} ventes
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
