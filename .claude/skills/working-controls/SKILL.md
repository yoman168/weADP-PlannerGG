---
name: working-controls
description: Make the controls in a generated HTML mockup actually work — tabs, filters, search, row selection, steppers, keypads, dropdowns, toggles, sort, and save buttons that respond — using small inline vanilla JS that changes state within the one screen and never navigates. Use when generating or fixing screen mockups, prototypes, or any standalone HTML UI whose buttons do nothing.
---

# Working controls

A mockup gets shown to the person who asked for it, and they click things. A
screen where nothing responds reads as broken rather than unfinished — the
reviewer stops judging the design and starts wondering whether it loaded. Every
control that looks pressable should do the thing it obviously means, inside
this one screen.

## The line: state, not navigation

**Do** change what this screen shows.

- Tab strips and segmented controls swap the panel below them.
- Filter chips and date-range pills select, and the numbers above them change.
- Search filters the rows already on the page. So does a column sort.
- Checkboxes select rows, drive a "3 selected" count, and enable bulk actions.
- Quantity steppers, keypads, and sliders write into the field they belong to,
  and any total recomputes.
- Dropdowns and menus open and close; so do accordions and inline drawers.
- Toggles flip and stay flipped.
- Destructive or saving actions confirm inline: the button goes busy briefly,
  then a toast or an inline note says what happened, and the row updates.

**Do not** change which screen you are on.

- No script that swaps whole screens in and out, no hidden containers holding
  other screens, no routing.
- Anything that opens a *different* screen carries `data-screen="<that
  screen's name>"` and nothing else. The host decides. See the
  `screen-mockups` skill for how a set of screens is linked.

## Use buttons for actions

Actions go on `<button>`. Anchors are for opening other screens.

A preview host pins `href` and cancels anchor clicks so a mockup cannot
navigate away from the page it is embedded in — so an action written as
`<a href="#">Approve</a>` is dead on arrival, and looks like your script is
broken when it is not. `<button type="button">` is unaffected.

## Writing the script

- One `<script>` at the end of `<body>`. Inline, vanilla, no CDN, no framework.
- Keep it small. This is a mockup: thirty lines that make ten controls respond
  beats three hundred lines of state management.
- Delegate from `document` where it saves repetition:
  `document.addEventListener('click', e => { const el = e.target.closest('[data-tab]'); … })`.
- Guard everything. A `querySelector` that returns null must not throw and take
  the rest of the page down with it — a mockup that half-works is worth more
  than one that dies on load.
- No `alert()`, no `confirm()`, no `prompt()`. They are blocked in sandboxed
  previews and they look nothing like the product. Show a toast, an inline
  message, or a disabled state.
- No timers that never stop, no polling, no network calls. Fake latency with a
  single `setTimeout` of 400–800ms when a save needs to feel real.
- Never `location.href`, `window.open`, `history.pushState`, or a form that
  submits. A `<form>` needs `onsubmit="return false"` or a `preventDefault`.

## Content that reacts needs content to react with

Hard-code enough rows that filtering and sorting visibly do something — a table
of three rows makes every filter look identical. Ten to twenty rows with a
spread of statuses, dates, departments and amounts is enough for the controls to
prove themselves.

## Checklist before finishing a screen

- Click every control you drew. Anything that does nothing: make it work, or
  make it plainly non-interactive.
- The nav marks *this* screen as current.
- Nothing navigates, opens a window, or throws in the console on load.
- Reloading the page returns it to its starting state — no storage, no leftovers.
