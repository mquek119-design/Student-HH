'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchIngredients, type IngredientSuggestion } from '@/app/recipes/actions';
import { canonicalName } from '@/lib/ingredients';
import { Reveal } from '@/components/motion/Reveal';
import type { ParsedIngredient } from '@/lib/parseIngredient';

interface IngredientAutocompleteProps {
  onAdd: (ingredient: ParsedIngredient & { ingredientId?: string }) => void;
}

/**
 * Ingredient input with autocomplete suggestions.
 * Shows existing canonical names as user types, allowing them to reuse
 * existing ingredients. Also allows adding new ingredients.
 */
export function IngredientAutocomplete({ onAdd }: IngredientAutocompleteProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string>('');
  const debounceTimer = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search as user types
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchIngredients(query);
      setSuggestions(results);
      setSelectedIndex(-1);
      setIsOpen(true);
    } catch (_error) {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError('');

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the search
    debounceTimer.current = setTimeout(() => {
      performSearch(value);
    }, 200);
  }, [performSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNew();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else {
          handleAddNew();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, suggestions, selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      const element = document.getElementById(`ingredient-option-${selectedIndex}`);
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelectSuggestion = (suggestion: IngredientSuggestion) => {
    onAdd({
      quantity: 1,
      unit: 'whole',
      name: suggestion.name,
      ingredientId: suggestion.id,
    });
    setInput('');
    setError('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleAddNew = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter an ingredient name');
      return;
    }

    // Simple validation: must have at least quantity and ingredient name
    // For now, create with quantity 1 whole and name as typed
    const canonical = canonicalName(trimmed);
    if (!canonical) {
      setError('An ingredient needs a name.');
      return;
    }

    onAdd({
      quantity: 1,
      unit: 'whole',
      name: trimmed,
    });
    setInput('');
    setError('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const _highlightMatch = (text: string, query: string) => {
    const canonical = canonicalName(query);
    if (!canonical) return text;

    const index = text.toLowerCase().indexOf(canonical.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        <span>{text.slice(0, index)}</span>
        <span className="font-semibold">{text.slice(index, index + canonical.length)}</span>
        <span>{text.slice(index + canonical.length)}</span>
      </>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-xs relative">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Quick add ingredient</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input.trim() && suggestions.length > 0 && setIsOpen(true)}
          placeholder="e.g. Chicken breast"
          className="w-full px-3 py-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg"
          autoComplete="off"
        />
        {error && <p className="font-body-sm text-[12px] text-error">{error}</p>}
        {!error && (
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Type to see suggestions, or just type a new ingredient name and press Enter.
          </span>
        )}
      </label>

      {isOpen && suggestions.length > 0 && (
        <Reveal>
          <div className="absolute top-full left-0 right-0 z-10 mt-xs bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-ambient-card overflow-hidden">
            <ul className="max-h-[240px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.id}>
                  <button
                    id={`ingredient-option-${index}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-md transition-colors ${
                      selectedIndex === index
                        ? 'bg-primary-container text-on-primary-container'
                        : 'hover:bg-surface-container-highest'
                    } font-body-sm`}
                  >
                    {suggestion.imageUrl && (
                      <img
                        src={suggestion.imageUrl}
                        alt=""
                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{suggestion.name}</div>
                      {suggestion.canonicalName !== suggestion.name && (
                        <div className="text-[12px] text-on-surface-variant truncate">
                          ({suggestion.canonicalName})
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      {isLoading && input.trim() && (
        <div className="text-[12px] text-on-surface-variant">Searching…</div>
      )}

      {!isLoading && input.trim() && suggestions.length === 0 && isOpen && (
        <div className="text-[12px] text-on-surface-variant">
          No existing ingredients found. Press Enter to add "{input.trim()}" as a new ingredient.
        </div>
      )}
    </div>
  );
}
