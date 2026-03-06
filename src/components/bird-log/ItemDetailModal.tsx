"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { saveItem, removeItem, isItemSaved } from '@/lib/pile';

interface Item {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  rating?: number;
  notes?: string;
  image?: string;
}

interface CategoryConfig {
  label: string;
  titleLabel: string;
  subtitleLabel: string;
}

interface ItemDetailModalProps {
  item: Item;
  config: CategoryConfig;
  onClose: () => void;
  onSaveChange?: () => void;
}

export function ItemDetailModal({ item, config, onClose, onSaveChange }: ItemDetailModalProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isItemSaved(item.id));
  }, [item.id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function toggleSave() {
    if (saved) {
      removeItem(item.id);
      setSaved(false);
    } else {
      saveItem({
        id: item.id,
        category: item.category,
        title: item.title,
        subtitle: item.subtitle,
        rating: item.rating,
        notes: item.notes,
        image: item.image,
      });
      setSaved(true);
    }
    onSaveChange?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-sm w-full mx-4 border border-neutral-200 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
            {config.label}
          </span>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* Image */}
        {item.image && (
          <div className="relative w-full h-40 bg-neutral-100">
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">
              {config.titleLabel}
            </p>
            <p className="text-sm font-bold">{item.title}</p>
          </div>

          {item.subtitle && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">
                {config.subtitleLabel}
              </p>
              <p className="text-xs text-neutral-600">{item.subtitle}</p>
            </div>
          )}

          {item.rating != null && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">Rating</p>
              <p className="text-xs">{'★'.repeat(Math.round(item.rating))} {item.rating}/10</p>
            </div>
          )}

          {item.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">Notes</p>
              <p className="text-xs text-neutral-600 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="px-4 pb-4">
          <button
            onClick={toggleSave}
            className={`w-full text-[10px] uppercase tracking-widest py-2 border transition-colors ${
              saved
                ? 'bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-600'
                : 'text-neutral-700 border-neutral-300 hover:border-neutral-800 hover:text-neutral-900'
            }`}
          >
            {saved ? '✓ Saved to My Pile' : '+ Save to My Pile'}
          </button>
        </div>
      </div>
    </div>
  );
}
