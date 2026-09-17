'use client';

/**
 * The choice that links a customer engagement to a product: does it start one,
 * or add a feature to one already under way. Shared between creating a
 * customer and, for one made before this existed, linking it after the fact.
 */

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import type { ProjectLinkKind } from '@/lib/we-adk-mock/projects';

export type ProductLink =
  | { kind: 'new-build'; productName: string }
  | { kind: 'feature-improvement'; productId: string; featureArea: string };

export function ProductLinkFields({
  products,
  value,
  onChange,
}: {
  /** Products this engagement could be improving instead of starting. */
  products: { id: string; name: string }[];
  value: ProductLink;
  onChange: (next: ProductLink) => void;
}) {
  return (
    <div className="border-border/70 bg-muted/20 flex flex-col gap-2.5 rounded-xl border p-3">
      <p className="text-muted-foreground text-xs font-medium">This engagement is for</p>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="radio"
          name="product-link-kind"
          className="mt-1"
          checked={value.kind === 'new-build'}
          onChange={() => onChange({ kind: 'new-build', productName: '' })}
        />
        <span className="flex-1">
          <span className="font-medium">Building a new product</span>
          {value.kind === 'new-build' && (
            <Input
              value={value.productName}
              onChange={(event) => onChange({ kind: 'new-build', productName: event.target.value })}
              placeholder="Product name"
              className="mt-1.5 h-8 text-sm"
            />
          )}
        </span>
      </label>

      <label
        className={
          products.length === 0
            ? 'flex items-start gap-2.5 text-sm opacity-50'
            : 'flex items-start gap-2.5 text-sm'
        }
      >
        <input
          type="radio"
          name="product-link-kind"
          className="mt-1"
          disabled={products.length === 0}
          checked={value.kind === 'feature-improvement'}
          onChange={() =>
            onChange({
              kind: 'feature-improvement',
              productId: products[0]?.id ?? '',
              featureArea: '',
            })
          }
        />
        <span className="flex-1">
          <span className="font-medium">Improving an existing product</span>
          {value.kind === 'feature-improvement' && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <Select
                value={value.productId}
                onValueChange={(productId) => onChange({ ...value, productId })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Which product?" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={value.featureArea}
                onChange={(event) => onChange({ ...value, featureArea: event.target.value })}
                placeholder="Which feature? e.g. Route optimization"
                className="h-8 text-sm"
              />
            </div>
          )}
        </span>
      </label>
    </div>
  );
}
