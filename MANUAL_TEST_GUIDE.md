# Manual Testing Guide - Drink State Synchronization

This guide provides step-by-step instructions for manually testing the drink synchronization feature. This testing is required because the feature involves **3D visual rendering and real-time multiplayer synchronization** that must be verified in actual browsers.

## Prerequisites

- ✅ Server running on port 3000
- ✅ Two or more browser windows/tabs (Chrome, Firefox, or Safari)
- ✅ Keyboard for input controls

## Starting the Server

```bash
npm start
```

Server should output: `Server listening on port 3000`

## Test Session Setup

1. Open 2-3 browser windows side-by-side
2. Navigate all windows to: `http://localhost:3000`
3. Each window should show the name entry screen

## Acceptance Criteria Tests

### AC1-2: Drink Ordering and Carrying (Visual Synchronization)

**Objective**: Verify that drinks are visible when ordered and synchronized across clients.

**Steps**:
1. In Window 1: Enter name "Player1" and press Enter
2. In Window 2: Enter name "Player2" and press Enter
3. Both players should see each other on the screen
4. In Window 1: Use arrow keys to move to bar area
   - Target position: x < 300, y > 440 (top-left area of screen)
5. In Window 1: Press **'e'** key to order drink

**Expected Results**:
- ✅ Window 1: Drink mesh appears in Player1's hand
  - Visual: Small transparent cylindrical shape (cup-like)
  - Position: Attached to player, not floating in air
  - Color: Light blue, semi-transparent
- ✅ Window 2: Drink mesh appears in Player1's hand (synchronized)
  - Same visual appearance as Window 1
  - Drink follows Player1 as they move
- ✅ Browser console (both windows): No JavaScript errors
- ✅ Browser console (both windows): No WebSocket errors

**If Failed**:
- Check browser console for errors
- Verify server is running and WebSocket connection is established
- Verify player actually reached bar area (try moving more to top-left)

---

### AC3: Drink Dropping (Ground Drinks)

**Objective**: Verify that dropped drinks appear on the ground for all players.

**Steps**:
1. Continue from previous test (Player1 has drink)
2. Note Player1's current position (x, y coordinates)
3. In Window 1: Press **'q'** key to drop drink

**Expected Results**:
- ✅ Window 1: Drink disappears from Player1's hand
- ✅ Window 1: Drink appears on ground at Player1's position
  - Visual: Same cylindrical mesh, now on floor
  - Position: At Player1's feet, not floating
- ✅ Window 2: Drink appears on ground at same position (synchronized)
- ✅ Both windows: Ground drink is visible and rendered correctly
- ✅ Browser console (both windows): No errors

**If Failed**:
- Check if drink is positioned at (0,0) instead of player position (bug)
- Verify drink mesh is visible (check camera angle, lighting)
- Check console for rendering errors

---

### AC4: Drink Kicking (Physics Synchronization)

**Objective**: Verify that drinks can be kicked and physics are synchronized.

**Steps**:
1. Continue from previous test (drink on ground)
2. In Window 2: Move Player2 near the dropped drink
   - Get within 30 pixels of drink (about 3 player widths)
3. In Window 2: Press **'f'** key to kick drink

**Expected Results**:
- ✅ Window 2: Drink moves away from Player2
  - Direction: Away from kicking player
  - Distance: Approximately 100 pixels (kick force)
  - Motion: Smooth, realistic physics
- ✅ Window 1: Drink moves in same direction/distance (synchronized)
- ✅ Both windows: Final drink position is identical
- ✅ Physics appear realistic and smooth
- ✅ Browser console (both windows): No errors

**If Failed**:
- Verify player is within 30 pixels of drink (move closer)
- Check if drink ID is being sent correctly (console.log in code)
- Verify kick physics calculation (direction, force)

---

### AC5: State Persistence (Disconnect/Reconnect)

**Objective**: Verify drink state survives player disconnect and reconnect.

**Steps**:
1. Setup:
   - Player1 has drink in hand (order new drink if needed)
   - At least one drink on the ground
2. In Window 2: Press **F5** to refresh page (simulates disconnect)
3. In Window 2: Re-enter name "Player2" and rejoin game
4. Wait 2-3 seconds for full state synchronization

**Expected Results**:
- ✅ Window 2 (after reconnect): Player1's drink is visible in their hand
  - Drink state correctly restored
  - Visual rendering is correct
- ✅ Window 2 (after reconnect): All ground drinks are visible
  - Correct positions maintained
  - Correct number of drinks
- ✅ Window 2: Can interact with drinks normally (kick them)
- ✅ Browser console (Window 2): No errors during reconnect
- ✅ Browser console (Window 2): Welcome message received with player states

**If Failed**:
- Check welcome message in network tab (should include players and groundDrinks)
- Verify stripWs() function preserves hasDrink and drinkType fields
- Check client handler for welcome message processes drink state

---

### AC6: Server Validation (Anti-Cheat)

**Objective**: Verify server rejects invalid drink actions.

**Test 6A: Cannot Order While Away From Bar**

**Steps**:
1. Move Player1 away from bar area (x > 300 or y < 440)
2. Press **'e'** to try ordering drink

**Expected Results**:
- ✅ Window 1: Drink does NOT appear
- ✅ Server rejects the request (check server logs)
- ✅ Browser console: No errors (graceful handling)

**Test 6B: Cannot Order While Already Holding Drink**

**Steps**:
1. Player1 orders drink at bar (if not already holding one)
2. Press **'e'** again to try ordering second drink

**Expected Results**:
- ✅ Window 1: Second drink does NOT appear
- ✅ Player1 still has exactly 1 drink
- ✅ Server rejects the request

**Test 6C: Cannot Kick Drink That's Too Far Away**

**Steps**:
1. Drop a drink on ground
2. Move player far away from drink (> 30 pixels)
3. Press **'f'** to try kicking

**Expected Results**:
- ✅ Drink does NOT move
- ✅ Client validation prevents sending request (or server rejects if sent)
- ✅ Browser console: No errors

**If Failed**:
- Check server validation logic for each action
- Verify client-side validation matches server-side validation
- Check console for validation error messages

---

### AC7: Responsiveness (< 100ms Latency)

**Objective**: Verify drink interactions feel responsive with minimal lag.

**Steps**:
1. Perform all drink actions multiple times:
   - Order drink (press 'e')
   - Drop drink (press 'q')
   - Kick drink (press 'f')
2. Observe timing of visual feedback

**Expected Results**:
- ✅ **Local player sees INSTANT feedback** (< 50ms perceived latency)
  - Order: Drink appears immediately in hand
  - Drop: Drink disappears from hand immediately
  - Kick: Drink moves immediately
- ✅ **Remote players see updates within 100ms**
  - Drink state changes appear quickly
  - No noticeable lag on local network
- ✅ **No stuttering or jankiness**
  - Animations are smooth
  - Physics are fluid
  - Frame rate remains high

**Measurement Tips**:
- Use browser DevTools Performance tab to measure actual timings
- Record screen and play back frame-by-frame to measure latency
- Compare local vs remote update times

**If Failed**:
- Check for optimistic updates (client should update immediately)
- Verify network messages are sent without delay
- Check for unnecessary re-renders or performance issues

---

## Additional Verification

### Console Error Check

**For ALL tests above**, after each test:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Verify: **Zero JavaScript errors**
4. Verify: **Zero WebSocket errors**

**Common errors to watch for**:
- `Uncaught TypeError: Cannot read property 'x' of undefined`
- `WebSocket connection failed`
- `THREE.Object3D: .add: object not an instance of THREE.Object3D`

### Visual Quality Check

Verify visual rendering quality:

- ✅ Drinks are transparent (not solid)
- ✅ Drinks have glass-like appearance
- ✅ Drinks cast shadows (if lighting is enabled)
- ✅ Drinks are correctly sized (not too big or too small)
- ✅ Drinks are positioned correctly (not clipping through ground/players)
- ✅ No Z-fighting or rendering glitches

### Network Synchronization Check

Verify synchronization quality:

- ✅ All clients show identical drink states
- ✅ Ground drink positions match exactly across clients
- ✅ Kick physics produce same result on all clients
- ✅ No "rubber-banding" or position corrections

---

## Test Results Documentation

After completing all tests, document results using this template:

```markdown
## Manual Test Results - Drink State Synchronization

**Date**: [YYYY-MM-DD]
**Tester**: [Your Name]
**Browser**: [Chrome/Firefox/Safari version]
**Environment**: [localhost/staging/production]

### Acceptance Criteria Status

- [ ] AC1-2: Drink ordering and carrying (visual sync) - PASS/FAIL
- [ ] AC3: Drink dropping (ground drinks) - PASS/FAIL
- [ ] AC4: Drink kicking (physics sync) - PASS/FAIL
- [ ] AC5: State persistence (disconnect/reconnect) - PASS/FAIL
- [ ] AC6: Server validation (anti-cheat) - PASS/FAIL
- [ ] AC7: Responsiveness (< 100ms latency) - PASS/FAIL

### Issues Found

1. [Issue description]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]
   - Screenshots: [attach if available]

### Console Errors

- [ ] Zero console errors in all tests
- [ ] If errors found: [list them here]

### Overall Result

- [ ] ALL TESTS PASSED - Ready for approval
- [ ] SOME TESTS FAILED - Fixes required (see issues above)

### Screenshots (Optional)

[Attach screenshots showing]:
- Drink in player's hand
- Ground drinks
- Multiple players with drinks
- Console with no errors
```

---

## Automated Testing (Future)

This project now includes Puppeteer-based E2E tests that can automate these manual tests:

```bash
npm run test:e2e
```

**Note**: Automated tests require:
- Server running on port 3000
- Headless browser support
- Puppeteer properly installed

The automated tests cover all 7 acceptance criteria and provide the same verification as manual testing, but can be run as part of CI/CD pipelines.

---

## Troubleshooting

### Server Won't Start

```bash
# Kill existing node processes
taskkill /F /IM node.exe  # Windows
pkill -9 node             # Mac/Linux

# Start fresh
npm start
```

### Drinks Not Visible

- Check browser console for Three.js errors
- Verify WebGL is enabled in browser
- Try different browser (Chrome recommended for WebGL)
- Check camera position/angle

### Synchronization Issues

- Verify WebSocket connection is established (check Network tab)
- Check server logs for message broadcasts
- Verify both clients are running same version of code
- Try refreshing both browsers

### Physics Not Working

- Verify proximity check (must be within 30 pixels)
- Check server logs for kick validation
- Verify drink ID matches between client and server

---

## Next Steps

After completing manual testing:

1. **If all tests pass**:
   - Update `qa_report.md` with "Manual testing completed - all acceptance criteria verified"
   - Update `implementation_plan.json` qa_signoff status to "approved"
   - Ready for merge to master

2. **If tests fail**:
   - Document failing tests and errors
   - Create bug report with reproduction steps
   - Developer fixes issues and commits with message: `fix: [description] (qa-requested)`
   - Re-run QA validation
   - Repeat manual testing to confirm fixes
