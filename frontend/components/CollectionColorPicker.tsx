"use client";

import {
  COLLECTION_FILE_COLORS,
  type CollectionFileColor,
} from "@/lib/collectionsApi";

type CollectionColorPickerProps = {
  value: CollectionFileColor;
  onChange: (color: CollectionFileColor) => void;
  disabled?: boolean;
};

export function CollectionColorPicker({
  value,
  onChange,
  disabled = false,
}: CollectionColorPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-stone-800">Colour</p>
      <div
        className="collections-color-grid"
        role="radiogroup"
        aria-label="Colour"
      >
        {COLLECTION_FILE_COLORS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className="collections-color-option"
              style={{
                borderColor: selected ? option.value : "rgb(214 211 209)",
                backgroundColor: selected ? `${option.value}18` : "transparent",
              }}
              onClick={() => onChange(option.value)}
              disabled={disabled}
            >
              <span
                className="collections-color-option__swatch"
                style={{ backgroundColor: option.value }}
                aria-hidden
              />
              <span className="collections-color-option__label">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
