# The Discovery Editorial: A Design System for Cinematic Content

## 1. Overview & Creative North Star
This design system is built upon the Creative North Star of **"The Digital Curator."** In an era of infinite scrolls and cluttered grids, we reject the "warehouse" aesthetic of standard streaming platforms. Instead, we embrace an editorial, high-end boutique feel that treats every film and show as a piece of art. 

The system moves beyond traditional layouts by utilizing **intentional asymmetry** and **tonal depth**. We break the "template" look by overlapping typography with imagery and using generous, breathing white space (or "dark space") to guide the user’s eye. This isn't just a utility; it’s a cinematic experience that begins the moment the app is opened.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, obsidian foundation to allow content imagery to "pop" with cinematic intensity.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define sections or containers. 
Boundaries must be created through **Background Tonal Shifts**. For example, a `surface-container-low` section should sit on a `surface` background to create a soft, sophisticated distinction. 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical, layered sheets of fine paper or frosted glass.
- **Base:** `surface` (#0a0e14)
- **Deepest Depth:** `surface-container-lowest` (#000000) for immersive video backgrounds.
- **Raised Layers:** Use `surface-container` (#151a21) through `surface-container-highest` (#20262f) to indicate interactive priority. 
- **Nesting Logic:** An inner card should always be one tier higher (e.g., `surface-container-high`) than its parent container (`surface-container`) to create a natural, "physical" lift.

### The Glass & Gradient Rule
To achieve a premium feel, floating navigation bars and modal overlays must utilize **Glassmorphism**. Use a semi-transparent `surface` color with a `backdrop-blur` of 20px–30px.
- **Signature Accent:** Primary CTAs should not be flat. Use a linear gradient from `primary` (#9aa8ff) to `primary-container` (#8c9bf3) at a 135-degree angle to provide a "soulful" glow.

---

## 3. Typography: The Editorial Voice
We use a dual-typeface system to balance high-end personality with functional readability.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "tech-chic" feel. Use `display-lg` (3.5rem) with tight tracking (-2%) for hero titles to create an authoritative, cinematic impact.
*   **Body & Labels (Inter):** The workhorse. Inter provides unmatched legibility at small sizes. Use `body-md` (0.875rem) for metadata and descriptions to keep the interface feeling light and accessible.

**Hierarchy as Identity:** Bold headlines (`headline-lg`) should be used sparingly to anchor the page, while `label-sm` in `on-surface-variant` (#a8abb3) provides a quiet, sophisticated metadata layer that doesn't compete with the content.

---

## 4. Elevation & Depth
In this system, shadows are a last resort; **Tonal Layering** is the primary driver of hierarchy.

*   **The Layering Principle:** Depth is achieved by "stacking" surface tokens. A `surface-container-lowest` search bar on a `surface-container` header creates a recessed, tactile feel without a single drop shadow.
*   **Ambient Shadows:** If a floating element (like a context menu) requires a shadow, use a large blur (32px+) and low opacity (6%). The shadow must be tinted with the `on-surface` color to mimic natural light refraction.
*   **The "Ghost Border" Fallback:** For accessibility in high-density areas, use a "Ghost Border." Apply the `outline-variant` (#44484f) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons & Interaction
*   **Primary:** Rounded `md` (0.75rem). Gradient fill (Primary to Primary-Container). No border. Label in `on-primary`.
*   **Secondary:** Ghost style. Transparent fill with a 15% opacity `outline-variant` border.
*   **Tertiary:** Text-only with a subtle `primary` underline on hover.

### Content Cards
*   **The Cinematic Poster:** Use `xl` (1.5rem) corner radius for movie posters. **Forbid the use of divider lines.** Separate the title and metadata from the card using a vertical 8px spacing (`2` in the spacing scale).
*   **Layered Info:** Place titles on a `surface-container-high` chip that slightly overlaps the bottom edge of the poster for an asymmetrical, custom look.

### Input Fields
*   **Text Inputs:** Use `surface-container-highest` as the fill. On focus, transition to a `primary` Ghost Border. Helper text must use `label-sm` in `on-surface-variant`.

### Immersive Components (Contextual)
*   **The "Now Playing" Bar:** A floating glassmorphic bar at the screen bottom. Uses `surface-bright` at 70% opacity with a heavy backdrop blur.
*   **Discovery Chips:** `full` (9999px) radius. Unselected chips should match the background with a 10% `outline-variant`; selected chips should use the `primary` fill.

---

## 6. Do's and Don'ts

### Do
*   **Use Asymmetry:** Place high-quality movie stills off-center and let typography overlap the image edge.
*   **Embrace Negative Space:** Use spacing `10` (2.5rem) and `12` (3rem) to let major sections breathe.
*   **Trust the Tones:** Let the difference between `surface` and `surface-container` do the work that lines used to do.

### Don't
*   **Don't use pure black (#000) for backgrounds** (except in video players); it kills the depth of the deep navy obsidian tones.
*   **Don't use standard drop shadows.** If the surface doesn't feel "elevated," check your surface-tier nesting first.
*   **Don't use icons as primary navigators.** Always pair with a `label-md` to ensure the system remains "Trustworthy" and "User-Centric."