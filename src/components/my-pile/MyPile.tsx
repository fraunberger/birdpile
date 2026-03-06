"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSavedItems, removeItem, SavedItem } from '@/lib/pile';

const CATEGORY_LABELS: Record<string, string> = {
  movie: 'Movie',
  tv: 'TV Show',
  music: 'Music',
  restaurant: 'Restaurant',
  beer: 'Beer',
  cooking: 'Recipe',
  podcast: 'Podcast',
  book: 'Book',
};

export function MyPile() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    setItems(getSavedItems());
  }, []);

  function handleRemove(id: string) {
    removeItem(id);
    setItems(getSavedItems());
  }

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category))).sort()];

  const filtered = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-white font-mono text-neutral-900">
      <div className="max-w-2xl mx-auto p-6 min-h-screen flex flex-col">
        <header className="flex items-center justify-between mb-8 border-b border-neutral-300 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs font-bold uppercase tracking-widest text-neutral-600 hover:text-neutral-900">
              BirdFinds
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
              My Pile
            </span>
          </div>
        </header>

        <div className="flex items-center gap-4 mb-8">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest">My Pile</h1>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider mt-0.5">
              Want to check out — {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {/* Category filters */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {categories.map((cat) => {
              const count = cat === 'all' ? items.length : items.filter((i) => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border transition-colors ${
                    activeCategory === cat
                      ? 'bg-neutral-800 text-white border-neutral-800'
                      : 'text-neutral-400 border-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] || cat)} ({count})
                </button>
              );
            })}
          </div>
        )}

        <main className="flex-grow">
          {items.length === 0 ? (
            <div className="text-neutral-400 text-xs uppercase tracking-widest py-12 text-center space-y-3">
              <p>Nothing saved yet.</p>
              <p>
                <Link href="/" className="underline hover:text-neutral-700">
                  Browse logs
                </Link>{' '}
                and click any row to save an item.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-neutral-400 text-xs uppercase tracking-widest py-12 text-center">
              No items in this category.
            </div>
          ) : (
            <div className="border border-neutral-200">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left border-b border-r border-neutral-200">Title</th>
                    <th className="px-3 py-2 text-left border-b border-r border-neutral-200 w-24">Category</th>
                    <th className="px-3 py-2 text-center border-b border-r border-neutral-200 w-12">★</th>
                    <th className="px-3 py-2 text-center border-b border-neutral-200 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 border-b border-r border-neutral-200">
                        <p className="font-medium">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-neutral-400 text-[10px] mt-0.5">{item.subtitle}</p>
                        )}
                        {item.notes && (
                          <p className="text-neutral-400 text-[10px] mt-1 italic line-clamp-2">{item.notes}</p>
                        )}
                        {item.image && (
                          <div className="relative w-12 h-8 mt-1">
                            <Image src={item.image} alt={item.title} fill className="object-cover" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-r border-neutral-200 text-neutral-500">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </td>
                      <td className="px-3 py-2 border-b border-r border-neutral-200 text-center">
                        {item.rating || ''}
                      </td>
                      <td className="px-3 py-2 border-b border-neutral-200 text-center">
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-neutral-300 hover:text-red-500 transition-colors text-xs leading-none"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        <footer className="py-8 text-center text-xs text-neutral-300 mt-12 border-t border-neutral-200">
          — END —
        </footer>
      </div>
    </div>
  );
}
