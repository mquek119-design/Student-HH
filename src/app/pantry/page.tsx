import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCurrentUser, getHousemates, getLeftovers, getPantryItems } from '@/lib/queries';
import type { IngredientCategory, PantryItem } from '@/lib/types';
import { PantryItemRow } from '@/components/pantry/PantryItemRow';
import { AddPantryItem } from '@/components/pantry/AddPantryItem';
import { LeftoversBoard } from '@/components/pantry/LeftoversBoard';

export const metadata = { title: 'Pantry · Grub' };

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
                  <PantryItemRow key={item.id} item={item} />
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
  const [items, currentUser, leftovers, housemates] = await Promise.all([
    getPantryItems(),
    getCurrentUser(),
    getLeftovers(),
    getHousemates(),
  ]);

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
          icon="ti-package"
          title="Your cupboard is giving nothing"
          body="Probably accurate."
        />
        <LeftoversBoard leftovers={leftovers} housemates={housemates} />
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

      <AddPantryItem />

      <LeftoversBoard leftovers={leftovers} housemates={housemates} />

      <PantrySection title="Shared" items={shared} />
      <PantrySection title="Personal" items={personal} />
    </PageShell>
  );
}
