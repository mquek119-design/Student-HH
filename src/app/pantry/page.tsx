import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCurrentUser, getPantryItems } from '@/lib/queries';
import type { IngredientCategory, PantryItem } from '@/lib/types';

export const metadata = { title: 'Pantry · HouseGrocer' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

const SECTION_META: Record<IngredientCategory, { label: string; icon: string }> = {
  fresh: { label: 'Fridge & Fresh', icon: 'kitchen' },
  cupboard: { label: 'Cupboard & Staples', icon: 'inventory_2' },
  frozen: { label: 'Freezer', icon: 'ac_unit' },
  household: { label: 'Household', icon: 'cleaning_services' },
};

function PantrySection({ title, items }: { title: string; items: PantryItem[] }) {
  const categories = (['fresh', 'cupboard', 'frozen', 'household'] as IngredientCategory[])
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="flex flex-col gap-md">
      <h2 className="font-title-md text-title-md">{title}</h2>

      {categories.length === 0 ? (
        <Card>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Nothing here yet.</p>
        </Card>
      ) : (
        categories.map(({ category, items: sectionItems }) => (
          <div key={category} className="flex flex-col gap-sm">
            <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant flex items-center gap-xs">
              <Icon name={SECTION_META[category].icon} className="text-[16px]" />
              {SECTION_META[category].label}
            </h3>

            <Card padded={false} className="overflow-hidden">
              <ul className="divide-y divide-surface-container-highest">
                {sectionItems.map((item) => (
                  <li key={item.id} className="p-md flex items-center gap-md">
                    <div className="flex-grow min-w-0">
                      <p className="font-body-lg text-body-lg truncate">{item.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant font-numeric-data">
                        {item.quantityRemaining}
                        {item.unit === '%' ? '%' : ` ${item.unit}`} left
                      </p>
                    </div>

                    {item.lowStock && (
                      <Badge tone="secondary" className="shrink-0">
                        Low
                      </Badge>
                    )}

                    <div className="flex items-center gap-xs shrink-0">
                      <button
                        type="button"
                        title="Mark used up"
                        aria-label={`Mark ${item.name} used up`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
                      >
                        <Icon name="remove_shopping_cart" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        title="Add to basket"
                        aria-label={`Add ${item.name} to basket`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Icon name="add_shopping_cart" className="text-[18px]" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))
      )}
    </section>
  );
}

export default async function PantryPage() {
  const [items, currentUser] = await Promise.all([getPantryItems(), getCurrentUser()]);

  const shared = items.filter((item) => item.isShared);
  const personal = items.filter((item) => !item.isShared && item.ownerUserId === currentUser.id);
  const lowCount = shared.filter((item) => item.lowStock).length;

  if (items.length === 0) {
    return (
      <PageShell>
        <PageHeader
          title="House Pantry"
          subtitle="What you already have, so the shop doesn't buy it twice."
        />
        <EmptyState
          icon="kitchen"
          title="Pantry is empty"
          body="Nothing is recorded as being in the house yet. Once items are tracked here, recipes show what you already have and the basket skips it."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="House Pantry"
        subtitle="What you already have. The optimiser skips these when building the basket."
      />

      {lowCount > 0 && (
        <Card accent="secondary" className="flex items-center gap-sm">
          <Icon name="warning" filled className="text-secondary" />
          <p className="font-body-sm text-body-sm">
            <strong>{lowCount}</strong> shared item{lowCount === 1 ? ' is' : 's are'} running low
            and will be added to this week&apos;s basket.
          </p>
        </Card>
      )}

      <PantrySection title="Shared" items={shared} />
      <PantrySection title="Personal" items={personal} />
    </PageShell>
  );
}
