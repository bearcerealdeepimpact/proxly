/**
 * E2E tests for drink state synchronization
 * Tests all visual acceptance criteria for the drink system
 */

const puppeteer = require('puppeteer');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

describe('Drink State Synchronization E2E Tests', () => {
  let browser1, browser2;
  let page1, page2;

  // Helper to wait for element
  async function waitForElement(page, selector, timeout = 5000) {
    await page.waitForSelector(selector, { timeout });
  }

  // Helper to wait for network idle
  async function waitForNetworkIdle(page) {
    await page.waitForNetworkIdle({ timeout: 3000, idleTime: 500 });
  }

  // Helper to join game
  async function joinGame(page, playerName) {
    await page.goto(SERVER_URL, { waitUntil: 'networkidle0' });

    // Wait for name input
    await waitForElement(page, 'input[type="text"]');

    // Enter name
    await page.type('input[type="text"]', playerName);

    // Submit
    await page.keyboard.press('Enter');

    // Wait for game canvas to load
    await waitForElement(page, 'canvas');
    await waitForNetworkIdle(page);
  }

  // Helper to move player to position
  async function movePlayerTo(page, targetX, targetY) {
    // Get current position
    const position = await page.evaluate(() => {
      return {
        x: window.Game?.localPlayer?.x || 0,
        y: window.Game?.localPlayer?.y || 0
      };
    });

    // Calculate movement direction
    const dx = targetX - position.x;
    const dy = targetY - position.y;

    // Press arrow keys to move (simplified - actual implementation would need more sophistication)
    if (dx < 0) {
      await page.keyboard.down('ArrowLeft');
      await new Promise(r => setTimeout(r, Math.abs(dx) * 10));
      await page.keyboard.up('ArrowLeft');
    } else if (dx > 0) {
      await page.keyboard.down('ArrowRight');
      await new Promise(r => setTimeout(r, Math.abs(dx) * 10));
      await page.keyboard.up('ArrowRight');
    }

    if (dy > 0) {
      await page.keyboard.down('ArrowDown');
      await new Promise(r => setTimeout(r, Math.abs(dy) * 10));
      await page.keyboard.up('ArrowDown');
    } else if (dy < 0) {
      await page.keyboard.down('ArrowUp');
      await new Promise(r => setTimeout(r, Math.abs(dy) * 10));
      await page.keyboard.up('ArrowUp');
    }

    await new Promise(r => setTimeout(r, 500)); // Wait for movement to settle
  }

  // Helper to check console errors
  async function getConsoleErrors(page) {
    return await page.evaluate(() => {
      return window._testErrors || [];
    });
  }

  beforeAll(async () => {
    // Launch two browser instances
    browser1 = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    browser2 = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page1 = await browser1.newPage();
    page2 = await browser2.newPage();

    // Capture console errors
    [page1, page2].forEach(page => {
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error(`Browser console error: ${msg.text()}`);
        }
      });

      page.on('pageerror', error => {
        console.error(`Page error: ${error.message}`);
      });

      // Track errors in page context
      page.evaluateOnNewDocument(() => {
        window._testErrors = [];
        window.addEventListener('error', (e) => {
          window._testErrors.push(e.message);
        });
      });
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  });

  test('AC1-2: Players can order drinks and see them in hands (synchronized)', async () => {
    // Both players join
    await joinGame(page1, 'Player1');
    await joinGame(page2, 'Player2');

    // Move Player 1 to bar (x < 300, y > 440)
    await movePlayerTo(page1, 250, 450);

    // Player 1 orders drink
    await page1.keyboard.press('e');
    await new Promise(r => setTimeout(r, 500)); // Wait for network sync

    // Verify Player 1 sees drink in their hand
    const player1HasDrink = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink === true;
    });
    expect(player1HasDrink).toBe(true);

    // Verify Player 2 sees drink in Player 1's hand
    const player2SeesPlayer1Drink = await page2.evaluate(() => {
      const players = window.Game?.players;
      if (!players) return false;

      // Find Player1 in the players map
      for (let player of players.values()) {
        if (player.name === 'Player1') {
          return player.hasDrink === true;
        }
      }
      return false;
    });
    expect(player2SeesPlayer1Drink).toBe(true);

    // Check for console errors
    const errors1 = await getConsoleErrors(page1);
    const errors2 = await getConsoleErrors(page2);
    expect(errors1.length).toBe(0);
    expect(errors2.length).toBe(0);
  }, TEST_TIMEOUT);

  test('AC3: Dropped drinks appear on ground for all players', async () => {
    // Assuming Player 1 still has drink from previous test

    // Get Player 1's position before dropping
    const player1Position = await page1.evaluate(() => {
      return {
        x: window.Game?.localPlayer?.x,
        y: window.Game?.localPlayer?.y
      };
    });

    // Player 1 drops drink
    await page1.keyboard.press('q');
    await new Promise(r => setTimeout(r, 500)); // Wait for network sync

    // Verify Player 1 no longer has drink
    const player1StillHasDrink = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink;
    });
    expect(player1StillHasDrink).toBe(false);

    // Verify ground drink exists for Player 1
    const player1SeesGroundDrink = await page1.evaluate(() => {
      return window.Game?.groundDrinks?.size > 0;
    });
    expect(player1SeesGroundDrink).toBe(true);

    // Verify Player 2 sees ground drink
    const player2SeesGroundDrink = await page2.evaluate(() => {
      return window.Game?.groundDrinks?.size > 0;
    });
    expect(player2SeesGroundDrink).toBe(true);

    // Verify ground drink is at approximately Player 1's position
    const groundDrinkPosition = await page1.evaluate(() => {
      const drinks = window.Game?.groundDrinks;
      if (!drinks || drinks.size === 0) return null;

      const drink = drinks.values().next().value;
      return { x: drink.x, y: drink.y };
    });

    expect(groundDrinkPosition).not.toBeNull();
    expect(Math.abs(groundDrinkPosition.x - player1Position.x)).toBeLessThan(5);
    expect(Math.abs(groundDrinkPosition.y - player1Position.y)).toBeLessThan(5);

    // Check for console errors
    const errors1 = await getConsoleErrors(page1);
    const errors2 = await getConsoleErrors(page2);
    expect(errors1.length).toBe(0);
    expect(errors2.length).toBe(0);
  }, TEST_TIMEOUT);

  test('AC4: Ground drinks can be kicked with synced physics', async () => {
    // Get ground drink position before kick
    const beforeKick = await page1.evaluate(() => {
      const drinks = window.Game?.groundDrinks;
      if (!drinks || drinks.size === 0) return null;

      const drink = drinks.values().next().value;
      return {
        id: drink.id,
        x: drink.x,
        y: drink.y
      };
    });
    expect(beforeKick).not.toBeNull();

    // Move Player 2 near the drink
    await movePlayerTo(page2, beforeKick.x + 10, beforeKick.y + 10);

    // Player 2 kicks drink
    await page2.keyboard.press('f');
    await new Promise(r => setTimeout(r, 500)); // Wait for network sync

    // Verify drink moved for Player 2
    const afterKickPlayer2 = await page2.evaluate((drinkId) => {
      const drinks = window.Game?.groundDrinks;
      if (!drinks) return null;

      const drink = drinks.get(drinkId);
      if (!drink) return null;

      return { x: drink.x, y: drink.y };
    }, beforeKick.id);

    expect(afterKickPlayer2).not.toBeNull();
    const distanceMoved2 = Math.sqrt(
      Math.pow(afterKickPlayer2.x - beforeKick.x, 2) +
      Math.pow(afterKickPlayer2.y - beforeKick.y, 2)
    );
    expect(distanceMoved2).toBeGreaterThan(10); // Should have moved

    // Verify drink moved for Player 1 (synchronized)
    const afterKickPlayer1 = await page1.evaluate((drinkId) => {
      const drinks = window.Game?.groundDrinks;
      if (!drinks) return null;

      const drink = drinks.get(drinkId);
      if (!drink) return null;

      return { x: drink.x, y: drink.y };
    }, beforeKick.id);

    expect(afterKickPlayer1).not.toBeNull();

    // Verify both players see same position (synchronized)
    expect(Math.abs(afterKickPlayer1.x - afterKickPlayer2.x)).toBeLessThan(1);
    expect(Math.abs(afterKickPlayer1.y - afterKickPlayer2.y)).toBeLessThan(1);

    // Check for console errors
    const errors1 = await getConsoleErrors(page1);
    const errors2 = await getConsoleErrors(page2);
    expect(errors1.length).toBe(0);
    expect(errors2.length).toBe(0);
  }, TEST_TIMEOUT);

  test('AC5: Drink state persists across disconnect/reconnect', async () => {
    // Player 1 orders a drink
    await movePlayerTo(page1, 250, 450);
    await page1.keyboard.press('e');
    await new Promise(r => setTimeout(r, 500));

    // Verify Player 1 has drink
    const player1HasDrink = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink === true;
    });
    expect(player1HasDrink).toBe(true);

    // Get ground drinks count
    const groundDrinksCount = await page1.evaluate(() => {
      return window.Game?.groundDrinks?.size || 0;
    });

    // Player 2 disconnects and reconnects
    await page2.reload({ waitUntil: 'networkidle0' });
    await joinGame(page2, 'Player2');
    await new Promise(r => setTimeout(r, 1000)); // Wait for full state sync

    // Verify Player 2 sees Player 1's drink after reconnect
    const player2SeesPlayer1Drink = await page2.evaluate(() => {
      const players = window.Game?.players;
      if (!players) return false;

      for (let player of players.values()) {
        if (player.name === 'Player1') {
          return player.hasDrink === true;
        }
      }
      return false;
    });
    expect(player2SeesPlayer1Drink).toBe(true);

    // Verify Player 2 sees all ground drinks
    const player2GroundDrinksCount = await page2.evaluate(() => {
      return window.Game?.groundDrinks?.size || 0;
    });
    expect(player2GroundDrinksCount).toBe(groundDrinksCount);

    // Check for console errors
    const errors1 = await getConsoleErrors(page1);
    const errors2 = await getConsoleErrors(page2);
    expect(errors1.length).toBe(0);
    expect(errors2.length).toBe(0);
  }, TEST_TIMEOUT);

  test('AC6: Server validates drink actions', async () => {
    // Test 1: Cannot order drink while away from bar
    await movePlayerTo(page1, 400, 300); // Outside bar area

    const beforeOrder = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink;
    });

    await page1.keyboard.press('e');
    await new Promise(r => setTimeout(r, 500));

    const afterOrder = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink;
    });

    // Should not have changed (server rejected)
    expect(afterOrder).toBe(beforeOrder);

    // Test 2: Cannot order drink while already holding one
    await movePlayerTo(page1, 250, 450); // Move to bar
    await page1.keyboard.press('e'); // Order first drink
    await new Promise(r => setTimeout(r, 500));

    const hasDrinkCount1 = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink ? 1 : 0;
    });
    expect(hasDrinkCount1).toBe(1);

    await page1.keyboard.press('e'); // Try to order second drink
    await new Promise(r => setTimeout(r, 500));

    const hasDrinkCount2 = await page1.evaluate(() => {
      return window.Game?.localPlayer?.hasDrink ? 1 : 0;
    });
    expect(hasDrinkCount2).toBe(1); // Still only 1 drink

    // Test 3: Cannot kick drink that's too far away
    // Drop current drink
    await page1.keyboard.press('q');
    await new Promise(r => setTimeout(r, 500));

    // Move far away from drink
    await movePlayerTo(page1, 400, 300);

    const drinkPositionBefore = await page1.evaluate(() => {
      const drinks = window.Game?.groundDrinks;
      if (!drinks || drinks.size === 0) return null;

      const drink = drinks.values().next().value;
      return { x: drink.x, y: drink.y };
    });

    // Try to kick from far away
    await page1.keyboard.press('f');
    await new Promise(r => setTimeout(r, 500));

    const drinkPositionAfter = await page1.evaluate(() => {
      const drinks = window.Game?.groundDrinks;
      if (!drinks || drinks.size === 0) return null;

      const drink = drinks.values().next().value;
      return { x: drink.x, y: drink.y };
    });

    // Drink should not have moved (client validation prevented sending)
    expect(drinkPositionAfter.x).toBe(drinkPositionBefore.x);
    expect(drinkPositionAfter.y).toBe(drinkPositionBefore.y);
  }, TEST_TIMEOUT);

  test('AC7: Drink interactions feel responsive (< 100ms)', async () => {
    // Move to bar
    await movePlayerTo(page1, 250, 450);

    // Measure time for drink order response
    const orderStartTime = await page1.evaluate(() => Date.now());
    await page1.keyboard.press('e');

    // Wait for hasDrink to become true
    await page1.waitForFunction(() => {
      return window.Game?.localPlayer?.hasDrink === true;
    }, { timeout: 200 }); // Should be < 100ms but allow 200ms margin

    const orderEndTime = await page1.evaluate(() => Date.now());
    const orderLatency = orderEndTime - orderStartTime;

    expect(orderLatency).toBeLessThan(100); // Local update should be instant

    // Measure time for drink drop response
    const dropStartTime = await page1.evaluate(() => Date.now());
    await page1.keyboard.press('q');

    await page1.waitForFunction(() => {
      return window.Game?.localPlayer?.hasDrink === false;
    }, { timeout: 200 });

    const dropEndTime = await page1.evaluate(() => Date.now());
    const dropLatency = dropEndTime - dropStartTime;

    expect(dropLatency).toBeLessThan(100); // Local update should be instant

    // Verify remote player sees update within reasonable time
    await page2.waitForFunction(() => {
      const players = window.Game?.players;
      if (!players) return false;

      for (let player of players.values()) {
        if (player.name === 'Player1') {
          return player.hasDrink === false;
        }
      }
      return false;
    }, { timeout: 1000 }); // Network sync should be < 100ms but allow 1s for safety

    // Check for console errors
    const errors1 = await getConsoleErrors(page1);
    const errors2 = await getConsoleErrors(page2);
    expect(errors1.length).toBe(0);
    expect(errors2.length).toBe(0);
  }, TEST_TIMEOUT);
});
