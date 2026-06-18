# UI / UX Guidelines

Design and implementation principles distilled from playtesting feedback.
Apply these whenever building or reviewing any screen in the app.

---

## Visual Identity — Two Distinct Modes

The app has two audiences with different needs:

| Context | Tone | Style |
|---------|------|-------|
| **Builder / Editor** | Professional, focused | Tighter spacing, minimal personality, no casual greetings |
| **Player / Hunt** | Friendly, playful | Rounded corners, warmer tone, personal greetings ("Hi [name] 👋") welcome |

Never mix the two. A builder screen that feels like a game erodes trust. A player screen that feels like a spreadsheet kills fun.

---

## UI Design Principles

### Button Sizing (mobile-first)
- Default to **full-width buttons** on mobile.
- Up to **2 buttons per row** only when they are equal in visual weight and importance.
- **3 per row** only for icon-only controls with no labels.
- When in doubt: one button per row.

### Color Hierarchy
Palette: **blue + white + orange**.
- **Orange** → primary CTAs only (the one thing you want the user to do next).
- **Blue** → navigation, structure, secondary actions.
- **Red / bold colors** → reserved for genuinely destructive, high-consequence actions only. Do not use for ordinary delete controls.
- Keep colour usage consistent — don't let the same hue carry different meanings on different screens.

### Icon-Only Buttons
When an action has an unambiguous standard icon (✕ delete, ↑↓ reorder, 📷 camera, 📁 upload), the text label is redundant. Prefer icon-only to reduce clutter, especially on mobile. Always include an `aria-label` for accessibility.

### Rounded Corners
Rounded corners are appropriate for the **player / play mode** experience (friendly, game-like). In the **builder / editor**, use tighter radii for a more professional feel.

### Form Field Order
Required fields first, optional fields after. Optional fields should be visually marked (label suffix " (optional)"). Never bury a required field below optional ones.

---

## Implementation / UX Patterns

### Tap-to-Edit
Items in a list open for editing on tap. Do **not** add a separate edit/pencil button to each card — it clutters the card and duplicates the tap target. Reserve card-level buttons only for destructive actions (delete) or reorder handles.

### Drag-to-Reorder (not Up/Down Arrows)
Reordering via ↑↓ buttons is clunky, especially with many items. Use drag-and-drop with a visible drag handle (≡) instead. Up/down buttons should not be the primary reorder mechanism.

### Undo Over Confirmation Dialogs
For destructive actions (delete item, remove step), prefer an **undo toast** (brief notification + "Undo" button, ~5 seconds) over a blocking confirmation dialog. This is faster, less interrupting, and provides the same safety net.

### Progressive Disclosure in Editors / Forms
When a user moves past an initial setup step (e.g., starts adding items to a hunt), earlier setup sections should **collapse automatically** to a compact summary. Users can re-expand them if needed. Avoid keeping all sections simultaneously open as the form grows — it becomes overwhelming.

### Contextual Explanations for Non-Obvious Features
Whenever a UI element introduces a non-obvious concept (e.g., "Final item"), provide a brief inline explanation at the point of entry — not only in onboarding or docs. One sentence is enough: explain *what* it is and *why* it exists.
