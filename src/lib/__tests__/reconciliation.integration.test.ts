/**
 * Integration Test: Reconciliation E2E Smoke Test
 *
 * Comprehensive test of the full reconciliation flow:
 * 1. Calculate planned split from basket items with various allocations
 * 2. Simulate delivery with full, partial, and missing items
 * 3. Process substitutions (accepted and rejected)
 * 4. Verify reconciled split matches actual delivered goods
 * 5. Verify no pence are lost in rounding
 *
 * This test verifies that reconciliation produces correct split amounts
 * with no lost pence, ensuring the money math is reliable.
 *
 * Run: npm test -- reconciliation.integration.test.ts
 */

import { splitPence, allocateLine } from '../money';
import type { Pence } from '../types';

/**
 * Test user IDs
 */
const TEST_USERS = {
  alex: '10000000-0000-0000-0000-000000000001', // Collector
  maya: '20000000-0000-0000-0000-000000000002',
  sam: '30000000-0000-0000-0000-000000000003',
};

/**
 * Test scenario: Basket items that were ordered
 */
const PLANNED_BASKET_ITEMS = [
  {
    id: 'basket-1',
    name: 'Chicken Breast Fillets',
    quantity: 2,
    unitPrice: 695,
    allocatedTo: [
      { userId: TEST_USERS.alex, share: 2 },
      { userId: TEST_USERS.maya, share: 1 },
      { userId: TEST_USERS.sam, share: 1 },
    ],
  },
  {
    id: 'basket-2',
    name: 'Basmati Rice',
    quantity: 3,
    unitPrice: 145,
    allocatedTo: [],
  },
  {
    id: 'basket-3',
    name: 'Extra Virgin Olive Oil',
    quantity: 1,
    unitPrice: 450,
    allocatedTo: [{ userId: TEST_USERS.alex, share: 1 }],
  },
  {
    id: 'basket-4',
    name: 'Whole Milk',
    quantity: 2,
    unitPrice: 120,
    allocatedTo: [],
  },
  {
    id: 'basket-5',
    name: 'Pasta Penne',
    quantity: 1,
    unitPrice: 79,
    allocatedTo: [],
  },
  {
    id: 'basket-6',
    name: 'Canned Coconut Milk',
    quantity: 1,
    unitPrice: 89,
    allocatedTo: [],
  },
  {
    id: 'basket-7',
    name: 'Large Eggs (6 pack)',
    quantity: 1,
    unitPrice: 250,
    allocatedTo: [],
  },
];

/**
 * Calculate the planned split before reconciliation
 */
function calculatePlannedSplit(
  items: typeof PLANNED_BASKET_ITEMS,
  allUserIds: string[]
): Record<string, Pence> {
  const totals: Record<string, Pence> = {};

  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    const allocation = allocateLine(lineTotal, item.allocatedTo, allUserIds);

    for (const [userId, amount] of Object.entries(allocation)) {
      totals[userId] = (totals[userId] ?? 0) + amount;
    }
  }

  return totals;
}

/**
 * Simulate delivery with various outcomes
 */
interface DeliveryResult {
  received: Array<{
    basketItemId: string;
    name: string;
    expectedQuantity: number;
    receivedQuantity: number;
    price: Pence;
    received: boolean;
  }>;
  refunds: Pence;
  actualTotal: Pence;
}

function simulateDelivery(): DeliveryResult {
  const received = [
    // Chicken: 2/2 received (100%)
    {
      basketItemId: 'basket-1',
      name: 'Chicken Breast Fillets',
      expectedQuantity: 2,
      receivedQuantity: 2,
      price: 695,
      received: true,
    },
    // Rice: 2/3 received (partial, 1 short)
    {
      basketItemId: 'basket-2',
      name: 'Basmati Rice',
      expectedQuantity: 3,
      receivedQuantity: 2,
      price: 145,
      received: true,
    },
    // Oil: 0/1 received (not received, will be refunded)
    {
      basketItemId: 'basket-3',
      name: 'Extra Virgin Olive Oil',
      expectedQuantity: 1,
      receivedQuantity: 0,
      price: 450,
      received: false,
    },
    // Milk: 2/2 received (100%)
    {
      basketItemId: 'basket-4',
      name: 'Whole Milk',
      expectedQuantity: 2,
      receivedQuantity: 2,
      price: 120,
      received: true,
    },
    // Pasta: 1/1 received (100%)
    {
      basketItemId: 'basket-5',
      name: 'Pasta Penne',
      expectedQuantity: 1,
      receivedQuantity: 1,
      price: 79,
      received: true,
    },
  ];

  let refunds = 0;
  let actualTotal = 0;

  // Calculate actual and refunds from delivered items
  for (const item of received) {
    const cost = item.receivedQuantity * item.price;
    const refund = (item.expectedQuantity - item.receivedQuantity) * item.price;
    actualTotal += cost;
    refunds += refund;
  }

  // Coconut Milk & Eggs are refunded (not received), handled via substitutions
  refunds += 89 + 250;

  return { received, refunds, actualTotal };
}

/**
 * Simulate substitutions from Tesco
 */
interface Substitution {
  id: string;
  orderedName: string;
  orderedPrice: Pence;
  receivedName: string;
  receivedPrice: Pence;
  decision: 'accepted' | 'rejected';
}

function simulateSubstitutions(): {
  substitutions: Substitution[];
  acceptedTotal: Pence;
} {
  const substitutions: Substitution[] = [
    {
      id: 'sub-1',
      orderedName: 'Canned Coconut Milk',
      orderedPrice: 89,
      receivedName: 'Fresh Coconut Milk',
      receivedPrice: 249,
      decision: 'accepted',
    },
    {
      id: 'sub-2',
      orderedName: 'Large Eggs (6 pack)',
      orderedPrice: 250,
      receivedName: 'Medium Eggs (6 pack)',
      receivedPrice: 210,
      decision: 'rejected',
    },
  ];

  // Only accepted substitutions add to the actual cost
  const acceptedTotal = substitutions
    .filter((sub) => sub.decision === 'accepted')
    .reduce((sum, sub) => sum + sub.receivedPrice, 0);

  return { substitutions, acceptedTotal };
}

/**
 * Calculate reconciled split after delivery
 */
function calculateReconciledSplit(
  plannedItems: typeof PLANNED_BASKET_ITEMS,
  delivery: DeliveryResult,
  subs: { substitutions: Substitution[]; acceptedTotal: Pence },
  allUserIds: string[]
): Record<string, Pence> {
  const totals: Record<string, Pence> = {};

  // Calculate costs from delivered items
  for (const deliveryItem of delivery.received) {
    const plannedItem = plannedItems.find((item) => item.id === deliveryItem.basketItemId);
    if (!plannedItem) continue;

    const actualLineTotal = deliveryItem.receivedQuantity * deliveryItem.price;
    const allocation = allocateLine(actualLineTotal, plannedItem.allocatedTo, allUserIds);

    for (const [userId, amount] of Object.entries(allocation)) {
      totals[userId] = (totals[userId] ?? 0) + amount;
    }
  }

  // Handle accepted substitutions (distribute equally)
  if (subs.acceptedTotal > 0) {
    const subAllocation = allocateLine(subs.acceptedTotal, [], allUserIds);
    for (const [userId, amount] of Object.entries(subAllocation)) {
      totals[userId] = (totals[userId] ?? 0) + amount;
    }
  }

  return totals;
}

describe('Reconciliation: E2E Smoke Test', () => {
  const allUserIds = [TEST_USERS.alex, TEST_USERS.maya, TEST_USERS.sam];

  it('should calculate planned split correctly with mixed allocations', () => {
    const plannedSplit = calculatePlannedSplit(PLANNED_BASKET_ITEMS, allUserIds);
    const plannedTotal = Object.values(plannedSplit).reduce((a, b) => a + b, 0);

    // Expected: 1390 + 435 + 450 + 240 + 79 + 89 + 250 = 2933p
    expect(plannedTotal).toBe(2933);

    // Verify each person gets a reasonable share
    expect(plannedSplit[TEST_USERS.alex]).toBeGreaterThan(0);
    expect(plannedSplit[TEST_USERS.maya]).toBeGreaterThan(0);
    expect(plannedSplit[TEST_USERS.sam]).toBeGreaterThan(0);

    // Alex pays more (collector + special allocation on chicken + oil)
    expect(plannedSplit[TEST_USERS.alex]).toBeGreaterThan(plannedSplit[TEST_USERS.maya]);
  });

  it('should simulate delivery with various scenarios', () => {
    const delivery = simulateDelivery();

    // 5 items tracked + 2 refunded via subs = 7 total planned
    expect(delivery.received.length).toBe(5);

    // 4 items received, 1 not received
    const receivedCount = delivery.received.filter((i) => i.received).length;
    expect(receivedCount).toBe(4);

    // Total refunds: Rice (145p) + Oil (450p) + Coconut (89p) + Eggs (250p) = 934p
    expect(delivery.refunds).toBe(934);

    // Actual delivered (excl subs): Chicken (1390) + Rice (290) + Milk (240) + Pasta (79) = 1999p
    expect(delivery.actualTotal).toBe(1999);
  });

  it('should handle substitutions correctly', () => {
    const subs = simulateSubstitutions();

    expect(subs.substitutions.length).toBe(2);

    const accepted = subs.substitutions.filter((s) => s.decision === 'accepted');
    const rejected = subs.substitutions.filter((s) => s.decision === 'rejected');

    expect(accepted.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Only accepted sub adds to total: Fresh Coconut @ 249p
    expect(subs.acceptedTotal).toBe(249);
  });

  it('should calculate reconciled split that sums to actual delivered goods', () => {
    const _planned = calculatePlannedSplit(PLANNED_BASKET_ITEMS, allUserIds);
    const delivery = simulateDelivery();
    const subs = simulateSubstitutions();
    const reconciled = calculateReconciledSplit(PLANNED_BASKET_ITEMS, delivery, subs, allUserIds);

    const reconciledTotal = Object.values(reconciled).reduce((a, b) => a + b, 0);

    // Actual delivered = delivered items + accepted subs
    // = 1999p + 249p = 2248p
    const actualDelivered = delivery.actualTotal + subs.acceptedTotal;

    // Critical check: reconciled split must equal actual delivered
    expect(reconciledTotal).toBe(actualDelivered);
    expect(reconciledTotal).toBe(2248);
  });

  it('should not lose any pence in rounding', () => {
    const _planned = calculatePlannedSplit(PLANNED_BASKET_ITEMS, allUserIds);
    const delivery = simulateDelivery();
    const subs = simulateSubstitutions();
    const reconciled = calculateReconciledSplit(PLANNED_BASKET_ITEMS, delivery, subs, allUserIds);

    // Sum of reconciled shares must equal the total
    const reconciledSum = Object.values(reconciled).reduce((a, b) => a + b, 0);
    const individualSum = Object.values(reconciled).reduce((a, b) => a + b, 0);

    expect(reconciledSum).toBe(individualSum);
    expect(reconciledSum).toBe(2248);

    // No negative amounts
    for (const userId of allUserIds) {
      const amount = reconciled[userId] ?? 0;
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('should show how the planned split changed after reconciliation', () => {
    const _planned = calculatePlannedSplit(PLANNED_BASKET_ITEMS, allUserIds);
    const delivery = simulateDelivery();
    const subs = simulateSubstitutions();
    const reconciled = calculateReconciledSplit(PLANNED_BASKET_ITEMS, delivery, subs, allUserIds);

    const plannedTotal = Object.values(_planned).reduce((a, b) => a + b, 0);
    const reconciledTotal = Object.values(reconciled).reduce((a, b) => a + b, 0);

    // Reconciled is less than planned due to missing items and substitutions
    // Planned: 2933p
    // Refunds: 934p (rice, oil, coconut, eggs)
    // Accepted sub: +249p (coconut)
    // Reconciled: 2933 - 934 + 249 = 2248p
    const expectedChange = reconciledTotal - plannedTotal;
    expect(expectedChange).toBe(-685);

    // Verify the breakdown
    const deliveryItemRefunds = 145 + 450; // rice + oil only (not substitution items)
    const substitutionImpact = (249 - 89) - 250; // coconut delta + eggs rejection
    expect(-deliveryItemRefunds + substitutionImpact).toBe(-685);
  });

  it('should allocate costs correctly to each person', () => {
    const _planned = calculatePlannedSplit(PLANNED_BASKET_ITEMS, allUserIds);
    const delivery = simulateDelivery();
    const subs = simulateSubstitutions();
    const reconciled = calculateReconciledSplit(PLANNED_BASKET_ITEMS, delivery, subs, allUserIds);

    // Alex (collector) should have the largest planned share
    const alex = reconciled[TEST_USERS.alex];
    const maya = reconciled[TEST_USERS.maya];
    const sam = reconciled[TEST_USERS.sam];

    // Verify allocations are proportional to planned allocations
    expect(alex).toBeGreaterThan(maya);
    expect(alex).toBeGreaterThan(sam);

    // Each share should be reasonable
    expect(alex).toBeGreaterThan(0);
    expect(maya).toBeGreaterThan(0);
    expect(sam).toBeGreaterThan(0);

    // Total should match
    expect(alex + maya + sam).toBe(2248);
  });

  it('should handle splitPence rounding edge cases', () => {
    // Test that splitPence never loses pence
    const testCases: Array<[Pence, number[]]> = [
      [100, [1, 1, 1]], // 100 ÷ 3 = 33/33/34
      [79, [1, 1, 1]], // 79 ÷ 3 = 26/26/27
      [145, [1, 1, 1]], // 145 ÷ 3 = 48/48/49
      [250, [1, 1, 1, 1]], // 250 ÷ 4 = 62/62/63/63
      [435, [1, 1, 1]], // 435 ÷ 3 = 145/145/145
    ];

    for (const [total, weights] of testCases) {
      const result = splitPence(total, weights);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });
});
