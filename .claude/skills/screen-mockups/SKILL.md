---
name: screen-mockups
description: Generate a set of standalone HTML screen mockups from meeting notes or a PRD — one file per screen, each declaring where it sits in the IA and which other screens its controls open, so the set can be walked as a product. Use when asked for screen mockups, a UI mockup set, a clickable prototype, or screens from notes.
---

# Screen mockups

Turn notes into a set of screens. Not a screen — a set. Notes that mention a
login, a list, and the popup that list opens describe three things with three
places in a tree, and a single file holding all three cannot be placed,
reviewed, linked to, or handed over as three.

## The contract

Emit one fenced `html` block per screen. Before each block, one marker line:

```
PAGE: <screen name> · <Screen|Popup|Drawer> · <PC|Mobile> · from: <parent screen name, or Top>
```

Then the block. Repeat. Write nothing else — no prose before, between, or
after the blocks.

### `from:` is the information architecture

It says which screen this one **opens from**, and it matters as much as the
pixels. A screen that arrives without it is a screen nobody can place.

- A login opens from nothing: `from: Top`.
- A list reached from a sidebar item opens from the screen that sidebar
  belongs to.
- A popup or drawer opens from the screen that raises it — never from `Top`.
- Name the parent exactly as you named it in its own `PAGE:` line, and emit
  parents before their children.

### One screen per block

- A block renders exactly **one** screen.
- It contains the markup of that one screen only. No hidden containers holding
  the others, no `display:none` panels waiting to be shown, no `<template>`
  copies.
- No JavaScript that switches views, tabs, or pages.
- Navigation — sidebar, tabs, menu — may be drawn for context, but it is
  inert: no click handlers, no `href="#..."` that reveals another screen. Mark
  the item for **this** screen active — not the one that was active in the
  screen you copied the shell from, which is the mistake that makes a set of
  screens all claim to be the same page.
- Every destination in that navigation is its own block. A sidebar with six
  items and six screens in the notes means six blocks, not one file with six
  views inside.

### Linking the screens together

On any control that opens another screen you are producing — a sidebar item, a
card, a row, a button — add:

```html
data-screen="<that screen's exact PAGE name>"
```

The navigation stays inert. The attribute is how the set is linked back
together: a viewer reads it and moves to that screen. This is what makes the
files a product rather than a folder.

### Each file stands alone

- A complete standalone HTML document: doctype, `<head>` with a `<title>` that
  matches the screen name, `<body>`.
- All CSS inline in a `<style>` tag. No external CDN, no external fonts, no
  external images. Emoji and inline SVG are fine.
- Realistic content drawn from the notes — real labels, real column names, real
  figures. Never lorem ipsum.
- Match the language of the notes: Korean notes get a Korean UI.

## Worked example

Two screens, the second raised by the first. Shown here inside a four-backtick
block so the inner fences read as themselves:

````
PAGE: Sales / Checkout · Screen · PC · from: Top
```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sales / Checkout</title>
<style>/* … */</style></head><body>
  <nav>
    <a class="active">Sales / Checkout</a>
    <a data-screen="Daily Report">Daily Report</a>
  </nav>
  <button data-screen="Cash Payment">Cash</button>
</body></html>
```
PAGE: Cash Payment · Popup · PC · from: Sales / Checkout
```html
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Cash Payment</title>
<style>/* … */</style></head><body>…</body></html>
```
````

The sidebar is drawn on both, marked active on the screen it belongs to, and
carries `data-screen` on the items that lead elsewhere. Nothing navigates; the
attributes are what a viewer follows.

## Making the screens respond

A screen whose buttons do nothing reads as broken rather than unfinished. Tabs,
filters, search, sort, row selection, steppers and toggles should change what
the screen shows, driven by one small inline script. The `working-controls`
skill covers what to wire and where the line sits between changing state and
changing screens.

## What to do when the notes are thin

Return fewer screens rather than inventing features. If the notes explicitly
rule something out, do not build it. If a screen is described only as a name,
build the obvious version of it and keep it plain — a wrong guess rendered
confidently is worse than an empty state.

## Writing the files to disk

When asked for files rather than a reply, write one file per screen, named from
the screen in kebab case: `sales-checkout.html`, `cash-payment.html`. Keep the
`PAGE:` marker as an HTML comment on the first line of each file, so the set can
be reassembled later:

```html
<!-- PAGE: Cash Payment · Popup · PC · from: Sales / Checkout -->
```
