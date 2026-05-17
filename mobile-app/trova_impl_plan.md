# 🎬 Trova Premium — Android Implementation Plan

> Based on the codebase audit. Targets only the confirmed gaps. No iOS-only libraries.

---

## Status Snapshot

| Feature | Status |
|---|---|
| Toast on share / trailer error | ✅ Done (`toastiva` in `ResultView.js`, `TrailerModal.js`) |
| Toast on watchlist add/remove (via swipe in Watchlist) | ✅ Done (`App.js` L572, 586, 610, 628) |
| Toast on watchlist **bookmark toggle** in `ResultView` | ❌ Missing |
| Swipe-to-delete / swipe-to-watched in `WatchlistView` | ✅ Done (hand-rolled `PanResponder`) |
| Morphing text in hero + header | ✅ Done (local lib copy) |
| Progressive blur on hero + detail | ✅ Done (local `ProgressiveBlur` component) |
| Sticky blur header in `WatchlistView` on scroll | ✅ Done |
| FAB for quick actions | ❌ Missing |
| Collapsing sticky title bar in `ResultView` | ❌ Missing |

---

## Phase 1 — Toast on Bookmark Toggle `ResultView.js`
**Effort:** ⚡ 5 minutes | **Impact:** ⭐⭐⭐⭐⭐

### Problem
When the user taps the bookmark icon in `ResultView.js` (L606–622), `onToggleWatchlist(result)` is called — but the actual toast fires much later in `App.js` only after the **category picker modal is confirmed** (L572, L586). The user gets zero immediate feedback when they tap the icon.

### Fix
In `ResultView.js`, wrap the `onPress` at L608–611 to fire an **immediate** optimistic toast before delegating to `onToggleWatchlist`:

**File:** `src/components/ResultView.js`
**Target:** Lines 606–622 (the bookmark `TouchableOpacity`)

```diff
- onPress={() => {
-   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
-   onToggleWatchlist(result);
- }}
+ onPress={() => {
+   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
+   if (isInWatchlist) {
+     toastiva.info('Already saved — tap to manage');
+   } else {
+     toastiva.success('Adding to Watchlist…');
+   }
+   onToggleWatchlist(result);
+ }}
```

> `toastiva` is already imported at L9 — zero new imports needed.

### Acceptance Criteria
- Tapping bookmark with item NOT in watchlist → immediate "Adding to Watchlist…" toast appears
- Tapping bookmark with item already in watchlist → "Already saved — tap to manage" info toast appears
- The category picker modal still opens as before; no regression

---

## Phase 2 — Watchlist FAB (Floating Action Button)
**Effort:** 🔧 1–2 hours | **Impact:** ⭐⭐⭐⭐

### Problem
`WatchlistView.js` has no quick-add mechanism. Users must leave the Watchlist tab to find and add titles. There is also no shortcut to Discover or Search from within the Watchlist.

### Approach
Hand-roll a FAB using `Reanimated` + `GestureHandler` (both already installed). **Do NOT install `expo-fab`** — the hand-rolled approach gives full control and avoids an extra dependency.

### Implementation

**File:** `src/components/WatchlistView.js`

#### Step 1: Add FAB state + animated values

Add to the top of `WatchlistView` component body (after existing `useRef` declarations):
```js
const fabOpen   = useRef(new Animated.Value(0)).current;
const [fabExpanded, setFabExpanded] = useState(false);
```

#### Step 2: FAB toggle handler
```js
const toggleFab = () => {
  const toValue = fabExpanded ? 0 : 1;
  Animated.spring(fabOpen, {
    toValue,
    damping: 15,
    stiffness: 200,
    useNativeDriver: true,
  }).start();
  setFabExpanded(!fabExpanded);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
```

#### Step 3: FAB action items (render inside the main `<View>`)
```jsx
{/* ── FAB ───────────────────────── */}
<View style={styles.fabShell} pointerEvents="box-none">
  {/* Action 1 – Browse Movies */}
  <Animated.View style={{
    opacity: fabOpen,
    transform: [{ translateY: fabOpen.interpolate({ inputRange: [0,1], outputRange: [0, -56] }) }],
  }}>
    <TouchableOpacity style={[styles.fabMini, { backgroundColor: colors.surfaceContainer }]}
      onPress={() => { toggleFab(); onBrowseMovies?.(); }}
      accessibilityLabel="Browse movies">
      <Ionicons name="film-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  </Animated.View>

  {/* Action 2 – Browse TV */}
  <Animated.View style={{
    opacity: fabOpen,
    transform: [{ translateY: fabOpen.interpolate({ inputRange: [0,1], outputRange: [0, -116] }) }],
  }}>
    <TouchableOpacity style={[styles.fabMini, { backgroundColor: colors.surfaceContainer }]}
      onPress={() => { toggleFab(); onBrowseTV?.(); }}
      accessibilityLabel="Browse TV shows">
      <Ionicons name="tv-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  </Animated.View>

  {/* Main FAB button */}
  <TouchableOpacity
    style={[styles.fabMain, { backgroundColor: colors.primary }]}
    onPress={toggleFab}
    accessibilityRole="button"
    accessibilityLabel="Quick actions"
  >
    <Animated.View style={{ transform: [{ rotate: fabOpen.interpolate({ inputRange: [0,1], outputRange: ['0deg', '45deg'] }) }] }}>
      <Ionicons name="add" size={28} color={colors.onPrimary} />
    </Animated.View>
  </TouchableOpacity>
</View>
```

#### Step 4: Styles to add
```js
fabShell: {
  position: 'absolute',
  bottom: 100,       // above BottomNav
  right: 24,
  alignItems: 'center',
  zIndex: 20,
},
fabMain: {
  width: 56,
  height: 56,
  borderRadius: 28,
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
},
fabMini: {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 6,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
},
```

#### Step 5: Wire in `App.js`
Pass new props to `WatchlistView`:
```jsx
<WatchlistView
  items={watchlist}
  onRemove={handleRemoveWatchlistItem}
  onMarkWatched={handleMarkWatched}
  onSelect={handleSelectMatch}
  onBrowseMovies={() => handleTabPress('discover')}  {/* NEW */}
  onBrowseTV={() => handleTabPress('discover')}      {/* NEW */}
/>
```

### Acceptance Criteria
- FAB visible in bottom-right of Watchlist screen
- Tap FAB → rotates `+` to `×`, two mini-buttons animate up
- Tap "Browse Movies" → navigates to Discover tab, FAB collapses
- Tap anywhere outside FAB → FAB does not auto-close (requires explicit re-tap — simpler & safer on Android)
- FAB sits above `BottomNav` without overlapping

---

## Phase 3 — Collapsing Sticky Title Bar in `ResultView`
**Effort:** 🔴 2–3 hours | **Impact:** ⭐⭐⭐⭐⭐

### Problem
`ResultView.js` has a parallax backdrop with `heroTransform` and `heroContentMotion` animations (L319–352), but no sticky title bar that appears when the user scrolls past the hero. Once the hero disappears, the user loses context of which title they're reading.

### Approach
Use the existing `scrollY` `Animated.Value` (already wired at L130) to drive a sticky header that fades in as the user scrolls below `HERO_HEIGHT` (`verticalScale(600)`). **No new library needed** — pure Reanimated + existing values.

### Implementation

**File:** `src/components/ResultView.js`

#### Step 1: Add sticky header animated values (after L131)
```js
// Sticky header appears after hero scrolls out of view
const stickyOpacity = scrollY.interpolate({
  inputRange: [HERO_HEIGHT - 100, HERO_HEIGHT],
  outputRange: [0, 1],
  extrapolate: 'clamp',
});
const stickyTranslateY = scrollY.interpolate({
  inputRange: [HERO_HEIGHT - 100, HERO_HEIGHT],
  outputRange: [-16, 0],
  extrapolate: 'clamp',
});
```

#### Step 2: Add sticky bar JSX (just before `<Animated.ScrollView>` at L430)
```jsx
{/* ── Collapsing sticky title bar ─────────────────────── */}
<Animated.View
  pointerEvents="none"
  style={[
    styles.stickyTitleBar,
    {
      opacity: stickyOpacity,
      transform: [{ translateY: stickyTranslateY }],
      backgroundColor: colors.background + 'F0',
      borderBottomColor: colors.outlineVariant + '33',
    },
  ]}
>
  {Platform.OS === 'android' ? (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background + 'D9' }]} />
  ) : (
    <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
  )}
  <View style={styles.stickyTitleContent}>
    <Text
      style={[styles.stickyTitle, { color: colors.onSurface, ...typography.titleMd }]}
      numberOfLines={1}
    >
      {result?.title}
    </Text>
    {result?.year ? (
      <Text style={[{ color: colors.onSurfaceVariant, ...typography.labelSm }]}>
        {result.year}
      </Text>
    ) : null}
  </View>
</Animated.View>
```

> Note: `BlurView` is already installed (`expo-blur` in `package.json`). Import it at the top.

#### Step 3: Styles to add
```js
stickyTitleBar: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 56,
  zIndex: 20,
  borderBottomWidth: StyleSheet.hairlineWidth,
  overflow: 'hidden',
},
stickyTitleContent: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  gap: 10,
  height: '100%',
},
stickyTitle: {
  fontWeight: '800',
  flex: 1,
},
```

#### Step 4: Add `BlurView` import
```js
import { BlurView } from 'expo-blur';
```

> `expo-blur` is already in `package.json` at L19 — no installation needed.

### Acceptance Criteria
- Scrolling below the hero backdrop triggers the sticky bar fade-in
- Sticky bar shows the movie/show title + year
- Sticky bar uses a semi-transparent dark overlay on Android (not BlurView, which has limited Android support in Expo)
- Back-scrolling to the hero hides the bar again
- No layout shift or flicker during the transition

---

## Execution Order

```
Phase 1  →  Phase 2  →  Phase 3
  5 min       2 hrs       3 hrs
```

Start with **Phase 1** (zero risk, immediate visual payoff), then **Phase 3** (highest UX impact), then **Phase 2** (new feature, most code surface).

## Git Commit Messages

```bash
# After Phase 1
git add src/components/ResultView.js
git commit -m "FEAT: Add immediate toast on bookmark toggle in ResultView"

# After Phase 2
git add src/components/WatchlistView.js App.js
git commit -m "FEAT: Add FAB with Browse shortcuts to WatchlistView"

# After Phase 3
git add src/components/ResultView.js
git commit -m "FEAT: Add collapsing sticky title bar to ResultView"
```
