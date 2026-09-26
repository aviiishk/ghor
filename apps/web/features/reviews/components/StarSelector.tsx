import { Star } from 'lucide-react';

// DESIGN.md `star-selector`: five large stars, ink when filled, hairline when empty.
export function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="p-1"
          >
            <Star
              size={32}
              className={filled ? 'fill-ink text-ink' : 'fill-none text-hairline'}
              strokeWidth={1.75}
            />
          </button>
        );
      })}
    </div>
  );
}
