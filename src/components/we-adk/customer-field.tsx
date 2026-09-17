'use client';

/**
 * Who a project is for: type it, or pick one of the customers already on the books.
 *
 * Two earlier attempts got this wrong in the same way — by deciding for you.
 *
 * A native `<datalist>` came first. The browser draws that list itself, so it arrived
 * unstyled, landed nowhere near the field, and filtered itself down to whatever had
 * been typed — which is how a three-customer list showed up as one stray row.
 *
 * Then a `Select` with a "＋ New customer…" row, which put the field in one of two
 * modes and needed a link to get back out of the typing one. The link was the tell:
 * a control whose whole job is to undo a choice you only made to reach the field you
 * wanted is a control that should not exist.
 *
 * So: one field, no modes. It is always typeable, because a new customer has to be.
 * The chevron offers what is already there, because retyping a name you already have
 * is how one company becomes three spellings of itself.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui';

export function CustomerField({
  id,
  value,
  options,
  onChange,
  onKeyDown,
}: {
  id: string;
  value: string;
  /** Customers already named on other projects. */
  options: string[];
  onChange: (value: string) => void;
  onKeyDown?: (event: { key: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const typed = value.trim().toLowerCase();
  const picked = options.some((name) => name.toLowerCase() === typed);
  /*
   * Everything while the field is empty, and everything again once the value is one of
   * the options — otherwise picking a customer would narrow the list to that customer,
   * leaving no way to change your mind. Only a partial name narrows it.
   */
  const shown =
    !typed || picked ? options : options.filter((name) => name.toLowerCase().includes(typed));

  return (
    <div ref={wrap} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        /*
         * Escape belongs to the dialog. Radix listens for it on the document in the
         * capture phase, so it is already handled before it reaches this field — an
         * attempt to swallow it here only looked like it worked. Clicking away or
         * toggling the chevron is how the list closes.
         */
        onKeyDown={onKeyDown}
        placeholder="KOSIGN Logistics"
        autoComplete="off"
        className={options.length > 0 ? 'pr-9' : undefined}
      />

      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show existing customers"
          onClick={() => setOpen((value) => !value)}
          className="text-muted-foreground hover:text-foreground absolute top-0 right-0 flex h-9 w-9 items-center justify-center"
        >
          <ChevronDown className="size-4" />
        </button>
      )}

      {open && shown.length > 0 && (
        <ul className="bg-popover text-popover-foreground border-border absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border py-1 shadow-md">
          {shown.map((name) => (
            <li key={name}>
              <button
                type="button"
                // Keeps focus in the field, so the click lands instead of a blur.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="hover:bg-accent w-full px-3 py-1.5 text-left text-sm"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
