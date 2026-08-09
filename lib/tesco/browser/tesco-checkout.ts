// @ts-nocheck
/**
 * Tesco Checkout Browser Automation
 *
 * Mirrors src/browser/checkout.ts but for Tesco (trolley → checkout flow).
 *
 * IMPORTANT: This NEVER completes payment automatically.
 * - dryRun=true : Preview trolley only
 * - dryRun=false: Navigates to payment page, then pauses for manual completion
 */

const { chromium } = eval('require')('playwright');
import * as fs from 'fs';
import * as os from 'os';

const SESSION_FILE = `${os.homedir()}/.tesco/session.json`;

export interface TescoCheckoutResult {
  order_id: string;
  total: number;
  delivery_slot?: string;
  delivery_cost: number;
  items_count: number;
  status: 'preview' | 'payment_required' | 'completed';
  payment_url?: string;
}

async function loadSession(page: Page): Promise<void> {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error('No Tesco session found. Please run: npm run groc -- --provider tesco login');
  }
  const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  await page.context().addCookies(session.cookies);
}

/**
 * Navigate Tesco checkout flow and extract order details.
 *
 * IMPORTANT: Payment is NEVER completed automatically.
 */
export async function tescoCheckout(
  dryRun: boolean = true,
  options?: { fulfillmentMethod?: 'delivery' | 'collect'; postcode?: string; collectStore?: string }
): Promise<TescoCheckoutResult> {
  const browser = await chromium.launch({
    headless: false, // Always show browser — transparency for financial actions
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  try {
    await loadSession(page);

    console.log('🛒 Step 1: Loading Tesco trolley...');
    await page.goto('https://www.tesco.com/groceries/en-GB/trolley', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Accept cookies
    try {
      await page.click('#onetrust-accept-btn-handler', { timeout: 3000 });
    } catch {
      // No banner
    }

    await page.waitForTimeout(3000);

    // Extract trolley total
    const pageText = await page.textContent('body');
    const totalMatch = pageText?.match(/(?:total|trolley total)[:\s]*£(\d+\.?\d*)/i);
    const total = totalMatch ? parseFloat(totalMatch[1]) : 0;

    console.log(`💰 Trolley total: £${total}`);

    if (dryRun && !options?.fulfillmentMethod) {
      console.log('\n🔍 DRY RUN MODE');
      console.log('└─ Trolley preview only — no slot booked, no payment requested');
      await page.screenshot({ path: '/tmp/tesco-checkout-preview.png', fullPage: true });

      return {
        order_id: 'DRY_RUN',
        total,
        delivery_cost: 0,
        items_count: 0,
        status: 'preview',
      };
    }

    // Proceed to checkout to configure fulfillment/slots
    console.log('\n💳 Step 2: Proceeding to Tesco checkout...');

    const checkoutButton = await page.$(
      'button:has-text("Checkout now"), button:has-text("Checkout"), a:has-text("Checkout")'
    );

    if (!checkoutButton) {
      throw new Error('Checkout button not found on trolley page');
    }

    await checkoutButton.click();
    await page.waitForTimeout(5000);

    console.log('📍 Current URL:', page.url());

    // Configure delivery or Click+Collect store if requested
    await handleTescoFulfillment(page, options);

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE (with fulfillment)');
      await page.waitForTimeout(4000);
      
      const dryPageText = await page.textContent('body');
      
      // Try to find delivery/collection slot cost
      const deliveryCostMatch = dryPageText?.match(/(?:delivery|collection)[:\s]*£(\d+\.?\d*)/i);
      const deliveryCost = deliveryCostMatch ? parseFloat(deliveryCostMatch[1]) : 0;
      
      const finalTotalMatch = dryPageText?.match(/(?:order total|total)[:\s]*£(\d+\.?\d*)/i);
      const finalTotal = finalTotalMatch ? parseFloat(finalTotalMatch[1]) : total + deliveryCost;

      await page.screenshot({ path: '/tmp/tesco-checkout-preview-fulfillment.png', fullPage: true });

      return {
        order_id: 'DRY_RUN',
        total: finalTotal,
        delivery_cost: deliveryCost,
        items_count: 0,
        status: 'preview',
      };
    }

    // If redirected to slot selection
    const currentUrl = page.url();
    if (currentUrl.includes('slot') || currentUrl.includes('delivery')) {
      console.log('\n📅 Step 3: Delivery slot selection required...');
      console.log('⚠️  Browser is open — please select a delivery slot manually');
      console.log('⏳ Waiting for slot selection (up to 5 minutes)...');

      let slotSelected = false;
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(5000);
        const newUrl = page.url();
        if (!newUrl.includes('slot') && !newUrl.includes('delivery/choose')) {
          slotSelected = true;
          break;
        }
      }

      if (!slotSelected) {
        throw new Error('Slot selection timeout — no slot was selected');
      }

      console.log('✅ Slot confirmed');
    }

    // At payment / order review page
    console.log('\n💳 Step 4: Reviewing order...');
    await page.waitForTimeout(3000);

    const finalPageText = await page.textContent('body');
    const finalTotalMatch = finalPageText?.match(/(?:order total|total)[:\s]*£(\d+\.?\d*)/i);
    const finalTotal = finalTotalMatch ? parseFloat(finalTotalMatch[1]) : total;

    const deliveryCostMatch = finalPageText?.match(/(?:delivery)[:\s]*£(\d+\.?\d*)/i);
    const deliveryCost = deliveryCostMatch ? parseFloat(deliveryCostMatch[1]) : 0;

    await page.screenshot({ path: '/tmp/tesco-checkout-payment.png', fullPage: true });

    console.log('\n📊 Order Summary:');
    console.log(`├─ Items total: £${total}`);
    console.log(`├─ Delivery: £${deliveryCost}`);
    console.log(`└─ Order total: £${finalTotal}`);

    console.log('\n🛑 PAYMENT REQUIRED');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║  THIS CLI DOES NOT HANDLE PAYMENT        ║');
    console.log('║  Complete payment manually in browser     ║');
    console.log('║  OR use saved payment method if prompted  ║');
    console.log('╚═══════════════════════════════════════════╝');

    console.log('\n⏳ Keeping browser open for 5 minutes...');
    console.log('   Complete payment in the browser window to finish your order.\n');

    await page.waitForTimeout(300000); // 5 minutes

    // Check whether order completed
    const finalUrl = page.url();
    if (finalUrl.includes('confirmation') || finalUrl.includes('order-confirmation')) {
      const bodyText = await page.textContent('body');
      const orderId =
        bodyText?.match(/order\s+(?:number|id|#)[:\s]*([A-Z0-9-]+)/i)?.[1] || 'UNKNOWN';

      return {
        order_id: orderId,
        total: finalTotal,
        delivery_cost: deliveryCost,
        items_count: 0,
        status: 'completed',
      };
    }

    return {
      order_id: 'PENDING',
      total: finalTotal,
      delivery_cost: deliveryCost,
      items_count: 0,
      status: 'payment_required',
      payment_url: page.url(),
    };

  } finally {
    await browser.close();
  }
}

async function handleTescoFulfillment(
  page: any,
  options?: { fulfillmentMethod?: 'delivery' | 'collect'; postcode?: string; collectStore?: string }
): Promise<void> {
  if (!options || !options.fulfillmentMethod) return;

  const method = options.fulfillmentMethod;
  console.log(`Fulfilment configuration requested: ${method}`);

  try {
    if (method === 'collect') {
      // Find Click+Collect button/tab
      const collectBtn = await page.$(
        'button:has-text("Click+Collect"), button:has-text("Click & Collect"), a:has-text("Click & Collect"), a:has-text("Click+Collect")'
      );
      if (collectBtn) {
        await collectBtn.click();
        await page.waitForTimeout(3000);
      }

      // Look for postcode/store search input
      const searchInput = await page.$(
        'input[placeholder*="postcode" i], input[placeholder*="town" i], input[name="search" i], input[type="text"]'
      );
      if (searchInput) {
        const query = options.collectStore || "Coventry Cannon Park";
        await searchInput.fill(query);
        await page.waitForTimeout(1000);
        await searchInput.press('Enter');
        await page.waitForTimeout(4000);

        // Click first matching store or one containing "Cannon Park"
        const storeBtn = await page.$(
          'button:has-text("Cannon Park"), button:has-text("Coventry"), button:has-text("Select store"), button:has-text("Select")'
        );
        if (storeBtn) {
          await storeBtn.click();
          await page.waitForTimeout(4000);
        }
      }
    } else if (method === 'delivery') {
      // Find Delivery button/tab
      const deliveryBtn = await page.$('button:has-text("Delivery"), a:has-text("Delivery")');
      if (deliveryBtn) {
        await deliveryBtn.click();
        await page.waitForTimeout(3000);
      }

      // Enter postcode
      const postcodeInput = await page.$('input[placeholder*="postcode" i]');
      if (postcodeInput && options.postcode) {
        await postcodeInput.fill(options.postcode);
        await page.waitForTimeout(1000);
        await postcodeInput.press('Enter');
        await page.waitForTimeout(4000);

        // Click select address
        const selectBtn = await page.$('button:has-text("Select"), button:has-text("Use this address")');
        if (selectBtn) {
          await selectBtn.click();
          await page.waitForTimeout(4000);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to automate fulfillment selection:', err);
    await page.screenshot({ path: '/tmp/tesco-fulfillment-error.png' });
  }
}
