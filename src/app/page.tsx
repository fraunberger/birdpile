import Link from "next/link";
import Image from "next/image";
import { APP_CATALOG, BIRD_CATALOG } from "@/lib/birds";

export default function HomePage() {
  const appSlugSet = new Set<string>(APP_CATALOG.map((app) => app.slug));
  const prioritizedBirds = [
    ...APP_CATALOG,
    ...BIRD_CATALOG.filter((bird) => !appSlugSet.has(bird.slug)),
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="py-2 flex justify-center">
        <div className="relative w-96 h-24 md:w-112 md:h-28">
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
        <div className="grid grid-cols-3 gap-6 lg:grid-cols-4">
          {prioritizedBirds.map((bird) => {
            const app = APP_CATALOG.find((item) => item.slug === bird.slug);
            const isCardinal = bird.slug === "cardinal";
            const label = bird.slug.replace(/[_-]/g, " ");

            if (isCardinal) {
              return (
                <a
                  key={bird.slug}
                  href="https://birdfinds.com"
                  className="block relative aspect-square w-full group overflow-hidden"
                  title="Open birdfinds.com"
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
                </a>
              );
            }

            if (app) {
              return (
                <Link
                  key={bird.slug}
                  href={`/${bird.slug}`}
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
