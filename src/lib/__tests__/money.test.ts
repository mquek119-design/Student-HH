/**
 * Unit Tests for Money Functions
 *
 * Critical money path tests covering:
 * - splitPence(): No lost pence with various split scenarios
 * - allocateLine(): Correct allocation across users
 * - formatPence()/parsePounds(): Money parsing and formatting
 *
 * Run: npm test -- money.test.ts
 */

import { splitPence, allocateLine, formatPence, formatPenceBare, parsePounds } from '../money';
import type { Pence } from '../types';

describe('splitPence()', () => {
  describe('basic splits', () => {
    it('should split evenly when weights are equal', () => {
      const result = splitPence(300, [1, 1, 1]);
      expect(result).toEqual([100, 100, 100]);
      expect(result.reduce((a, b) => a + b)).toBe(300);
    });

    it('should split unevenly based on weights', () => {
      const result = splitPence(600, [2, 1, 1]);
      expect(result).toEqual([300, 150, 150]);
      expect(result.reduce((a, b) => a + b)).toBe(600);
    });

    it('should handle single person (no split)', () => {
      const result = splitPence(500, [1]);
      expect(result).toEqual([500]);
      expect(result.reduce((a, b) => a + b)).toBe(500);
    });
  });

  describe('rounding edge cases - no lost pence', () => {
    it('should handle 100p ÷ 3 = 34/33/33', () => {
      const result = splitPence(100, [1, 1, 1]);
      expect(result).toEqual([34, 33, 33]);
      expect(result.reduce((a, b) => a + b)).toBe(100);
    });

    it('should handle 79p ÷ 3 = 27/26/26', () => {
      const result = splitPence(79, [1, 1, 1]);
      expect(result).toEqual([27, 26, 26]);
      expect(result.reduce((a, b) => a + b)).toBe(79);
    });

    it('should handle 145p ÷ 3 = 49/48/48', () => {
      const result = splitPence(145, [1, 1, 1]);
      expect(result).toEqual([49, 48, 48]);
      expect(result.reduce((a, b) => a + b)).toBe(145);
    });

    it('should handle 250p ÷ 4 = 63/63/62/62', () => {
      const result = splitPence(250, [1, 1, 1, 1]);
      expect(result).toEqual([63, 63, 62, 62]);
      expect(result.reduce((a, b) => a + b)).toBe(250);
    });

    it('should handle large numbers without precision loss', () => {
      const result = splitPence(123456, [1, 1, 1]);
      expect(result.reduce((a, b) => a + b)).toBe(123456);
    });

    it('should handle 1p ÷ 3 = 1/0/0 (remainder goes to largest)', () => {
      const result = splitPence(1, [1, 1, 1]);
      expect(result).toEqual([1, 0, 0]);
      expect(result.reduce((a, b) => a + b)).toBe(1);
    });
  });

  describe('weighted splits with rounding', () => {
    it('should weight by provided factors', () => {
      const result = splitPence(600, [2, 1, 1]);
      const sum = result.reduce((a, b) => a + b);
      expect(sum).toBe(600);
      expect(result[0]).toBeGreaterThan(result[1]);
    });

    it('should handle 5-person split with rounding', () => {
      const result = splitPence(100, [1, 1, 1, 1, 1]);
      const sum = result.reduce((a, b) => a + b);
      expect(sum).toBe(100);
      expect(result).toEqual([20, 20, 20, 20, 20]);
    });

    it('should handle 7-person split with remainder', () => {
      const result = splitPence(100, [1, 1, 1, 1, 1, 1, 1]);
      const sum = result.reduce((a, b) => a + b);
      expect(sum).toBe(100);
      expect(result).toEqual([15, 15, 14, 14, 14, 14, 14]);
    });
  });

  describe('realistic scenarios', () => {
    it('should handle real basket line (£6.95 for chicken, 3 people)', () => {
      const result = splitPence(695, [1, 1, 1]);
      const sum = result.reduce((a, b) => a + b);
      expect(sum).toBe(695);
      expect(result).toEqual([232, 232, 231]);
    });

    it('should handle entire basket sum without losing pence', () => {
      const lineItems = [
        { total: 1390, weights: [2, 1, 1] },
        { total: 435, weights: [1, 1, 1] },
        { total: 450, weights: [1, 0, 0] },
        { total: 240, weights: [1, 1, 1] },
        { total: 79, weights: [1, 1, 1] },
        { total: 89, weights: [1, 1, 1] },
        { total: 250, weights: [1, 1, 1] },
      ];

      let totalSpent = 0;
      for (const item of lineItems) {
        const allocated = splitPence(item.total, item.weights);
        const itemSum = allocated.reduce((a, b) => a + b);
        expect(itemSum).toBe(item.total);
        totalSpent += itemSum;
      }

      expect(totalSpent).toBe(2933);
    });
  });

  describe('negative/edge values', () => {
    it('should handle negative total', () => {
      const result = splitPence(-100, [1, 1, 1]);
      const sum = result.reduce((a, b) => a + b);
      expect(sum).toBe(-100);
      expect(result.every((x) => x <= 0)).toBe(true);
    });

    it('should return empty array for empty weights', () => {
      const result = splitPence(100, []);
      expect(result).toEqual([]);
    });
  });
});

describe('allocateLine()', () => {
  const user1 = '00000000-0000-0000-0000-000000000001';
  const user2 = '00000000-0000-0000-0000-000000000002';
  const user3 = '00000000-0000-0000-0000-000000000003';
  const allUsers = [user1, user2, user3];

  describe('with explicit allocations', () => {
    it('should allocate to specific users only', () => {
      const result = allocateLine(450, [{ userId: user1, share: 1 }], allUsers);

      expect(result[user1]).toBe(450);
      expect(result[user2]).toBeUndefined();
      expect(result[user3]).toBeUndefined();
    });

    it('should split among allocated users by weight', () => {
      const result = allocateLine(695, [
        { userId: user1, share: 2 },
        { userId: user2, share: 1 },
        { userId: user3, share: 1 },
      ], allUsers);

      const total = result[user1] + result[user2] + result[user3];
      expect(total).toBe(695);
      expect(result[user1]).toBeGreaterThan(result[user2] * 1.5);
    });

    it('should handle single-user allocation', () => {
      const result = allocateLine(1000, [{ userId: user1, share: 1 }], allUsers);

      expect(result[user1]).toBe(1000);
      expect(Object.keys(result).length).toBe(1);
    });
  });

  describe('with empty allocations (split equally)', () => {
    it('should split equally among all house users', () => {
      const result = allocateLine(300, [], allUsers);

      expect(result[user1]).toBe(100);
      expect(result[user2]).toBe(100);
      expect(result[user3]).toBe(100);
      expect(Object.keys(result).length).toBe(3);
    });

    it('should handle uneven splits with remainder', () => {
      const result = allocateLine(100, [], allUsers);

      const total = result[user1] + result[user2] + result[user3];
      expect(total).toBe(100);
    });
  });

  describe('realistic scenarios', () => {
    it('should allocate chicken (collector + 2 others)', () => {
      const result = allocateLine(1390, [
        { userId: user1, share: 2 },
        { userId: user2, share: 1 },
        { userId: user3, share: 1 },
      ], allUsers);

      const total = result[user1] + result[user2] + result[user3];
      expect(total).toBe(1390);
      expect(result[user1]).toBeGreaterThan(690);
      expect(result[user1]).toBeLessThan(698);
    });

    it('should allocate rice (everyone equally)', () => {
      const result = allocateLine(435, [], allUsers);

      expect(result[user1]).toBe(145);
      expect(result[user2]).toBe(145);
      expect(result[user3]).toBe(145);
    });

    it('should allocate olive oil (collector only)', () => {
      const result = allocateLine(450, [{ userId: user1, share: 1 }], allUsers);

      expect(result[user1]).toBe(450);
      expect(result[user2]).toBeUndefined();
      expect(result[user3]).toBeUndefined();
    });

    it('should handle zero price', () => {
      const result = allocateLine(0, [], allUsers);

      expect(result[user1]).toBe(0);
      expect(result[user2]).toBe(0);
      expect(result[user3]).toBe(0);
    });
  });

  describe('money math guarantees', () => {
    it('should never lose pence in allocation', () => {
      const testCases = [
        { total: 695 as Pence, allocs: [{ userId: user1, share: 2 }, { userId: user2, share: 1 }, { userId: user3, share: 1 }] },
        { total: 100 as Pence, allocs: [] },
        { total: 450 as Pence, allocs: [{ userId: user1, share: 1 }] },
        { total: 79 as Pence, allocs: [] },
      ];

      for (const testCase of testCases) {
        const result = allocateLine(testCase.total, testCase.allocs, allUsers);
        const sum = Object.values(result).reduce((a, b) => a + b, 0);
        expect(sum).toBe(testCase.total);
      }
    });

    it('should never produce negative amounts', () => {
      const result = allocateLine(500, [
        { userId: user1, share: 1 },
        { userId: user2, share: 1 },
      ], allUsers);

      for (const amount of Object.values(result)) {
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('formatPence()', () => {
  it('should format positive pence correctly', () => {
    expect(formatPence(100)).toBe('£1.00');
    expect(formatPence(695)).toBe('£6.95');
    expect(formatPence(1000)).toBe('£10.00');
    expect(formatPence(50)).toBe('£0.50');
  });

  it('should format negative pence (refunds) correctly', () => {
    expect(formatPence(-100)).toBe('-£1.00');
    expect(formatPence(-695)).toBe('-£6.95');
  });

  it('should handle zero', () => {
    expect(formatPence(0)).toBe('£0.00');
  });

  it('should always show 2 decimal places', () => {
    expect(formatPence(1)).toBe('£0.01');
    expect(formatPence(10)).toBe('£0.10');
  });
});

describe('formatPenceBare()', () => {
  it('should format without currency symbol', () => {
    expect(formatPenceBare(100)).toBe('1.00');
    expect(formatPenceBare(695)).toBe('6.95');
  });

  it('should format negative values without currency symbol', () => {
    expect(formatPenceBare(-100)).toBe('1.00');
    expect(formatPenceBare(-695)).toBe('6.95');
  });
});

describe('parsePounds()', () => {
  it('should parse decimal string to pence', () => {
    expect(parsePounds('1.00')).toBe(100);
    expect(parsePounds('6.95')).toBe(695);
    expect(parsePounds('10.50')).toBe(1050);
  });

  it('should parse currency symbol', () => {
    expect(parsePounds('£1.00')).toBe(100);
    expect(parsePounds('£6.95')).toBe(695);
  });

  it('should parse without decimals', () => {
    expect(parsePounds('10')).toBe(1000);
    expect(parsePounds('£10')).toBe(1000);
  });

  it('should handle single decimal place', () => {
    expect(parsePounds('1.5')).toBe(150);
    expect(parsePounds('10.1')).toBe(1010);
  });

  it('should strip whitespace', () => {
    expect(parsePounds(' 1.00 ')).toBe(100);
    expect(parsePounds('£ 10.50')).toBe(1050);
  });

  it('should strip commas (thousands separator)', () => {
    expect(parsePounds('1,000.00')).toBe(100000);
    expect(parsePounds('£1,234.56')).toBe(123456);
  });

  it('should handle negative values', () => {
    expect(parsePounds('-1.00')).toBe(-100);
    expect(parsePounds('-£10.50')).toBe(-1050);
  });

  it('should return null for invalid input', () => {
    expect(parsePounds('')).toBeNull();
    expect(parsePounds('abc')).toBeNull();
    expect(parsePounds('£abc')).toBeNull();
    expect(parsePounds('1.234')).toBeNull();
    expect(parsePounds('-')).toBeNull();
  });

  it('should reject more than 2 decimal places', () => {
    expect(parsePounds('1.001')).toBeNull();
    expect(parsePounds('1.999')).toBeNull();
  });
});
