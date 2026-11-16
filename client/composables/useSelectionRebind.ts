import type { SourceRange, StudioTarget, TargetKind } from '../types'
import { nextTick, onScopeDispose, watchEffect } from 'vue'
import { mappedElements, slideElement } from '../dom'
import { describeTarget as describe, parseHint, sameRange } from '../selection-target'
import { selection, selectedTargets, setSelectedTargets, studioOpen } from '../state'

/** Keep selected objects bound to the rendered slide after source changes. */
export function useSelectionRebind(no: () => number, content: () => string) {
  /**
   * After a write the slide re-renders and the old element is gone, often at a
   * slightly different line. Finding the nearest element of the same kind keeps
   * the selection, and every panel bound to it, alive across an edit.
   */
  async function reselect(hint: SourceRange | null, kind: TargetKind, tag?: string) {
    const expected = selection.value
    const slideNo = no()
    await nextTick()

    // A re-render can land a frame or several later, and binding at a fixed
    // delay bound the selection to the element that was about to be thrown
    // away: the outline vanished and the next press went to the slide instead
    // of to the overlay, so every other drag did nothing. Waiting for an
    // element that is actually in the document, and rebinding again if that one
    // is replaced too, is what keeps a selection alive across an edit.
    const deadline = Date.now() + 1500
    let bound: StudioTarget | null = null
    let fallback: StudioTarget | null = null

    while (Date.now() < deadline) {
      if (selection.value !== expected || no() !== slideNo || !studioOpen.value)
        return
      if ((!hint && !expected?.prop) || !slideElement(slideNo))
        return

      // Another block's text may have grown before this object. Its old DOM
      // signature can still locate it in the new source, unlike its old line.
      const resolved = expected ? describe(expected.el, slideNo, content()).range : null
      const line = (resolved ?? hint)?.[0] ?? 0
      const best = mappedElements(slideNo)
        .filter(el => expected?.prop
          ? el.dataset.studioProp === expected.prop
          : (el.dataset.studioKind ?? 'unknown') === kind && el.dataset.studioTag === tag)
        // Attached is the test, not visible: an element that has just been
        // given `v-click` is hidden at the current step, and refusing to
        // rebind to it leaves the selection on a node that no longer exists.
        .filter(el => document.contains(el))
        .map(el => ({ el, start: parseHint(el.dataset.studioSrc)?.[0] ?? Number.POSITIVE_INFINITY }))
        .sort((a, b) => Math.abs(a.start - line) - Math.abs(b.start - line))[0]?.el

      const candidate = best ? describe(best, slideNo, content()) : null
      fallback = candidate ?? fallback

      // The source is updated the moment the write returns, while the rebuilt
      // DOM lands a few frames later. Binding in between describes the old
      // element against the new Markdown, which cannot be traced, so the
      // selection came back with no range and nothing could be edited or
      // deleted afterwards. Waiting for the two to agree is the fix.
      if (candidate?.range || candidate?.prop) {
        bound = candidate
        break
      }

      await new Promise(resolve => setTimeout(resolve, 40))
    }

    // Keep what the user had if nothing can be traced at all. An edit that
    // briefly cannot be rebound used to empty the whole panel, which read as
    // the editor losing the thing you were working on.
    const next = bound ?? fallback
    if (next && selection.value === expected && no() === slideNo && studioOpen.value)
      selection.value = next
  }

  /**
   * Rebinds the selection when the slide is re-rendered under it.
   *
   * Any rebuild replaces the DOM, and the selection then points at a node that
   * is no longer on screen: the outline and the handles disappear, and the next
   * press lands on the slide rather than on them. That happens on every edit
   * the editor makes, and also when the author edits the Markdown by hand.
   */
  let rebinding = false
  let observer: MutationObserver | null = null

  watchEffect(() => {
    observer?.disconnect()
    observer = null

    if (!studioOpen.value)
      return

    // Watched on the document rather than on the slide, or even on the canvas.
    // A rebuild replaces the slide's own root, so an observer bound there is
    // watching a detached node from the first edit onwards. The canvas is no
    // better: Studio's open state is remembered, so on an ordinary page load
    // this effect runs before `#slide-content` exists, and nothing here is
    // reactive to the DOM appearing later. The result was an editor that
    // rebound correctly only if you had toggled it open by hand, which is why
    // the second drag worked while testing and not while presenting.
    observer = new MutationObserver(() => {
      const current = selection.value
      if (selectedTargets.value.length > 1 && selectedTargets.value.some(item => !document.contains(item.el))) {
        if (!rebinding) {
          rebinding = true
          reselectTargets(selectedTargets.value).finally(() => (rebinding = false))
        }
        return
      }
      if (rebinding || !current || document.contains(current.el))
        return

      // A selection that failed to trace has no range of its own, so the
      // element's own stamp is the hint. Without it the rebind gave up at once
      // and the selection stayed on a node that had gone.
      const hint = current.range ?? parseHint(current.el.dataset.studioSrc)
      rebinding = true
      reselect(hint, current.kind, current.tag).finally(() => (rebinding = false))
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })

  onScopeDispose(() => { observer?.disconnect() })

  /**
   * Selects a block that was just inserted.
   *
   * Insertion appends to the end of the slide, so the last matching element is
   * the new one. For a plain Markdown block there is no tag to match on, so the
   * last mapped element of the slide is the best available answer.
   */
  async function selectInserted(tag?: string, range?: SourceRange): Promise<boolean> {
    const expected = selection.value
    const slideNo = no()
    await nextTick()
    if (range) {
      const currentNo = slideNo
      const deadline = Date.now() + 1500
      while (Date.now() < deadline && no() === currentNo && selection.value === expected) {
        const candidate = mappedElements(currentNo)
          .filter(el => !tag || el.dataset.studioTag === tag)
          .map(el => describe(el, currentNo, content()))
          .find(item => item.range?.[0] === range[0] && item.range[1] === range[1])
        if (candidate) {
          selection.value = candidate
          return true
        }
        await new Promise(resolve => setTimeout(resolve, 40))
      }
      return false
    }
    await new Promise(resolve => setTimeout(resolve, 120))

    const candidates = mappedElements(no())
    const matching = tag ? candidates.filter(el => el.dataset.studioTag === tag) : candidates
    const el = matching.at(-1) ?? candidates.at(-1)
    if (el)
      selection.value = describe(el, no(), content())
    return !!el
  }

  async function selectInsertedMany(items: { range: SourceRange, tag?: string }[]) {
    if (!items.length) return false
    const expected = selection.value, expectedTargets = selectedTargets.value, slideNo = no()
    await nextTick()
    const deadline = Date.now() + 1500
    while (Date.now() < deadline && no() === slideNo && selection.value === expected && selectedTargets.value === expectedTargets && studioOpen.value) {
      const live = mappedElements(slideNo).map(el => describe(el, slideNo, content()))
      const targets = items.map(item => live.find(target => sameRange(target.range, item.range) && (!item.tag || item.tag === target.tag)))
      if (targets.every((target): target is StudioTarget => !!target)) {
        setSelectedTargets(targets)
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 40))
    }
    return false
  }

  async function reselectTargets(targets: StudioTarget[]) {
    const items = targets.flatMap(target => {
      const resolved = describe(target.el, no(), content()).range ?? target.range
      return resolved ? [{ range: resolved, tag: target.tag }] : []
    })
    return selectInsertedMany(items)
  }

  return { reselect, selectInserted, selectInsertedMany, reselectTargets }
}
