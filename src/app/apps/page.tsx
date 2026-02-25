import Link from "next/link";
import Image from "next/image";
import { APP_CATALOG, BIRD_CATALOG } from "@/lib/birds";

export default function AppsPage() {
  const appSlugSet = new Set<string>(APP_CATALOG.map((app) => app.slug));
  const prioritizedBirds = [
    ...APP_CATALOG,
    ...BIRD_CATALOG.filter((bird) => !appSlugSet.has(bird.slug)),
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="flex justify-center">
        <div className="relative w-56 h-56">
          <Image
            src="/logo.png"
            alt="Birdpile Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-3 gap-8">
          {prioritizedBirds.map((bird) => {
            const app = APP_CATALOG.find((item) => item.slug === bird.slug);
            const label = bird.slug.replace(/[_-]/g, " ");

            if (app) {
              return (
                <Link
                  key={bird.slug}
                  href={`/apps/${bird.slug}`}
                  className="block relative aspect-square w-full group overflow-hidden"
                >
                  <Image
                    src={`/birds/${bird.filename}`}
                    alt={label}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 33vw, 33vw"
                  />
                  <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white text-[10px] font-mono font-medium uppercase tracking-widest drop-shadow-md">
                      {label}
                    </span>
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={bird.slug}
                className="block relative aspect-square w-full group overflow-hidden"
              >
                <Image
                  src={`/birds/${bird.filename}`}
                  alt={label}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 768px) 33vw, 33vw"
                />
                <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white text-[10px] font-mono font-medium uppercase tracking-widest drop-shadow-md">
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
