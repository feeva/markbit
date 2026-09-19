# Known Limitations

These are not bugs in our own code — they're confirmed limitations of libraries
we depend on (Konva, html2canvas-pro) or of the embedding model itself, which
we've deliberately decided not to fix at this stage. The point of writing them
down is so nobody has to re-investigate the root cause from scratch the next
time the same symptom shows up.

---

## html2canvas-pro: box-shadow blur is not applied when combined with border-radius

**Symptom**: an element with `border-radius` that also has a `box-shadow` with
a blur radius > 0 gets captured as a hard-edged rectangular block instead of a
softly-blurred shadow.

**Cause**: a well-known, long-standing unresolved issue inherited from the
original html2canvas. To draw a `box-shadow`, it paints the actual shape far
off-screen (`SHADOW_MASK_OFFSET = 10000px`) and then repositions it back with
`ctx.shadowOffsetX/Y`; combined with border-radius clipping, this breaks the
blur. It reproduces identically after switching to the `html2canvas-pro` fork
— this is not a config or version issue on our side, it's a limitation of the
rendering engine itself.

Related upstream issues:

- https://github.com/niklasvh/html2canvas/issues/1856
- https://github.com/niklasvh/html2canvas/pull/3110
- https://github.com/niklasvh/html2canvas/pull/2367

**Impact**: since Markbit captures arbitrary third-party host pages, any
box-shadow on the page being captured may render differently than it actually
looks (as a hard-edged shadow instead of a soft one).

**Workaround (2026-09-19)**: the `public/embed-test.html` test fixture uses
`border`/`outline` instead of `box-shadow` so it doesn't expose this bug.
Fixing the renderer itself is out of scope for this project's size right now.

**Revisit when**: html2canvas-pro fixes this upstream, or real users
repeatedly flag shadow distortion in captured results.

---

## Konva Transformer: top-center/bottom-center resize handle hit-area offset

**Symptom**: when a shape is selected, only the top-center and bottom-center
resize handles keep the resize cursor/behavior active in an area extending
about one handle-height below the visible handle square. Left/right
(middle-left, middle-right) and corner handles don't have this issue. It's
constant regardless of zoom/pan level.

**Confirmed**: reproduces identically in Konva's own official demo — not
caused by our code (the z-order fix, the `nodes()` override, etc.) or our
config, but by `Transformer` itself. We read the anchor offset calculation in
`node_modules/konva/lib/shapes/Transformer.js` (`update()`,
`anchorSize/2 ± padding`) directly; with the default `padding: 0` the math is
symmetric on paper, so static analysis alone didn't pin down the cause. We
stopped investigating further once the official-demo reproduction confirmed
this is a library-level issue, not ours.

**Impact**: minor usability annoyance (the cursor switches to resize mode
slightly below the top/bottom handles), but the resize behavior itself works
correctly.

**Decision (2026-09-19)**: not fixing this now — not something we can resolve
quickly.

**Revisit when**: Konva ships a release that fixes it, or real users
repeatedly flag this UX.

---

## The overlay's mobile layout depends on the host page having a viewport meta tag

**Symptom**: on a mobile browser, the whole Markbit overlay (not just its own
UI — the entire host page) renders zoomed out and tiny, as if nothing
responsive is happening at all.

**Cause**: our overlay iframe is sized `100vw`/`100vh` relative to the _host
page's_ layout viewport, not the physical device width. If the host page has
no `<meta name="viewport" content="width=device-width, initial-scale=1">` of
its own, mobile browsers fall back to a ~980px desktop-style layout viewport
and zoom the whole page out to fit the real screen — taking our iframe (and
everything else on the page) down with it. This is not something our own code
can fix: the iframe we inject has its own correct viewport meta tag (see
frame.ts/embed.ts's `srcdoc`), but that only controls layout _inside_ the
iframe, not the _size the host page assigns to the iframe element itself_.

**Impact**: only affects host pages that don't already set a viewport meta
tag. In practice this is extremely rare in 2026 — it's been standard practice
since roughly 2015 — but if a customer's page happens to lack one, Markbit's
overlay inherits that page's existing mobile-rendering problem (which would
already be affecting the rest of their page too, independent of Markbit).

**Workaround (2026-09-19)**: `public/embed-test.html` now sets its own
viewport meta tag so it represents a realistic, well-formed host page.

**Revisit when**: real users report this on a host page that otherwise renders
fine on mobile (which would indicate our assumption above is wrong).
