<script setup lang="ts">
import type { MessageKey } from '../../i18n'
import { action, t, targetLabel } from '../../i18n'
import type { ClickState } from '../../md/clicks'
import { useNav } from '@slidev/client'
import { computed, ref, watch } from 'vue'
import { useStudio } from '../../context'
import { CLICK_ANIMATIONS, EMPTY_CLICKS, readClicks, writeClicks } from '../../md/clicks'
import { MOTION_PRESETS, readMotion, writeMotion } from '../../md/motion'
import { reportError, selection } from '../../state'
import StudioField from '../parts/StudioField.vue'

/**
 * The animation panel.
 *
 * Slidev's model is a sequence of clicks per slide, so the panel leads with
 * that sequence, which you can scrub to move the slide with you, and then edits how
 * the selected block joins in.
 */
const studio = useStudio()
const nav = useNav()

const clicks = computed(() => nav.clicksContext.value)
const total = computed(() => clicks.value.total)
const current = computed(() => clicks.value.current)

const range = computed(() => selection.value?.range ?? null)

/** Every stop on this slide, the slide's own state included. */
const steps = computed(() => {
  const from = clicks.value.clicksStart
  const to = Math.max(total.value, from)
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
})
const state = ref<ClickState>({ ...EMPTY_CLICKS })
const motion = ref<string | null>(null)
const motionDelay = ref(0)

watch([range, () => studio.content()], () => {
  if (!range.value) {
    state.value = { ...EMPTY_CLICKS }
    motion.value = null
    motionDelay.value = 0
    return
  }
  state.value = readClicks(studio.content(), range.value)
  const current = readMotion(studio.content(), range.value)
  motion.value = current.preset
  motionDelay.value = current.delay
}, { immediate: true })

const canStagger = computed(() => selection.value?.kind === 'list')
const canMotion = computed(() => !!selection.value?.tag)

async function apply(patch: Partial<ClickState>) {
  if (!range.value)
    return

  /*
   * A reveal asked for on one item of a list is applied to the list.
   *
   * The reveal is written as a `<v-click>` wrapper around the block's lines,
   * and around one item that splices an HTML block into the middle of the list:
   * it ends above and starts again below, so one list becomes three and an
   * ordered list restarts its numbering halfway down.
   *
   * Refusing would be a dead end, because the items fill the list and a click
   * on one always lands on the item rather than on the list. What the author
   * means is the thing Slidev writes as `<v-clicks>`: the list revealing its
   * items one at a time. That is what this does, and it says so.
   */
  let target = range.value
  if (selection.value?.kind === 'list-item') {
    const list = selection.value.el.closest<HTMLElement>('[data-studio-kind="list"]')
    const at = list?.dataset.studioSrc?.split(',').map(Number)
    if (!at || at.length !== 2 || !at.every(Number.isFinite)) {
      reportError(new Error(t('errorListTrace')))
      return
    }
    target = [at[0], at[1]]
    patch = { ...patch, stagger: true }
  }

  const next: ClickState = { ...state.value, ...patch, via: patch.via ?? (state.value.via === 'none' ? 'attr' : state.value.via) }
  await studio.commit(writeClicks(studio.content(), target, next), action('actionSetAnimation'))
}

async function disable() {
  if (!range.value)
    return
  await studio.commit(writeClicks(studio.content(), range.value, { ...state.value, via: 'none' }), action('actionRemoveAnimation'))
}

async function applyMotion(preset: string) {
  if (!range.value)
    return
  await studio.commit(
    writeMotion(studio.content(), range.value, preset || null, motionDelay.value),
    preset ? action('actionSetMotion') : action('actionRemoveMotion'),
  )
}

function scrub(value: number) {
  nav.go(studio.no(), value)
}

async function setTransition(value: string) {
  await studio.setFrontmatter({ transition: value || null }, action('actionSetTransition'))
}

const clickLabels: Record<string, MessageKey> = {
  '': 'clickDefault', none: 'clickNone', fade: 'clickFade', 'fade-in': 'clickFadeIn',
  up: 'clickUp', down: 'clickDown', left: 'clickLeft', right: 'clickRight', scale: 'clickScale',
}
const motionLabels: Record<string, MessageKey> = {
  'slide-up': 'motionSlideUp', 'slide-down': 'motionSlideDown',
  'slide-left': 'motionSlideLeft', 'slide-right': 'motionSlideRight',
  zoom: 'motionZoom', pop: 'motionPop', tilt: 'motionTilt',
}
const transitionLabels: Record<string, MessageKey> = {
  fade: 'transitionFade', 'fade-out': 'transitionFadeOut', 'slide-left': 'transitionLeft',
  'slide-right': 'transitionRight', 'slide-up': 'transitionUp', 'slide-down': 'transitionDown',
  'view-transition': 'transitionView', none: 'transitionNone',
}

const TRANSITIONS = ['', 'fade', 'fade-out', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'view-transition', 'none']
</script>

<template>
  <section class="studio-section">
    <h3 class="studio-section__title">
      {{ t('clickSequence') }}
    </h3>

    <!--
      The steps themselves, rather than a slider over them. A slider says how
      far along you are; what an author wants to know is how many steps the
      slide has, which one they are on, and how to get to any of the others,
      and a dozen numbered stops answers all three at a glance.
    -->
    <div class="studio-steps" role="group" :aria-label="t('clickSequence')">
      <button
        v-for="step in steps"
        :key="step"
        class="studio-step"
        :class="{ 'is-current': step === current, 'is-done': step < current }"
        :title="step === clicks.clicksStart ? t('withSlide') : t('step', { step })"
        @click="scrub(step)"
      >
        {{ step === clicks.clicksStart ? '0' : step }}
      </button>
    </div>

    <p class="studio-hint">
      {{ total > clicks.clicksStart
        ? t('stepProgress', { current, total })
        : t('noClickSteps') }}
    </p>
  </section>

  <div v-if="!selection || !range" class="studio-empty">
    {{ t('selectAnimate') }}
  </div>

  <template v-else>
    <section class="studio-section">
      <h3 class="studio-section__title">
        {{ t('targetReveal', { name: targetLabel(selection) }) }}
      </h3>

      <StudioField :label="t('appears')">
        <select :value="state.via === 'none' ? 'never' : 'click'" @change="($event.target as HTMLSelectElement).value === 'never' ? disable() : apply({ via: 'attr' })">
          <option value="never">{{ t('withSlide') }}</option>
          <option value="click">{{ t('onClick') }}</option>
        </select>
      </StudioField>

      <template v-if="state.via !== 'none'">
        <StudioField :label="t('atStep')">
          <input
            type="text"
            :value="state.at"
            placeholder="+1"
            :title="t('stepHint')"
            @change="apply({ at: ($event.target as HTMLInputElement).value || '+1' })"
          >
        </StudioField>

        <StudioField :label="t('animation')">
          <select :value="state.animation" @change="apply({ animation: ($event.target as HTMLSelectElement).value })">
            <option v-for="option in CLICK_ANIMATIONS" :key="option.id" :value="option.id">
              {{ t(clickLabels[option.id]) }}
            </option>
          </select>
        </StudioField>

        <StudioField :label="t('direction')">
          <select :value="state.hide ? 'hide' : 'show'" @change="apply({ hide: ($event.target as HTMLSelectElement).value === 'hide' })">
            <option value="show">{{ t('revealStep') }}</option>
            <option value="hide">{{ t('hideStep') }}</option>
          </select>
        </StudioField>

        <template v-if="canStagger">
          <StudioField :label="t('children')">
            <select :value="state.stagger ? 'stagger' : 'together'" @change="apply({ stagger: ($event.target as HTMLSelectElement).value === 'stagger' })">
              <option value="together">{{ t('revealTogether') }}</option>
              <option value="stagger">{{ t('oneAtTime') }}</option>
            </select>
          </StudioField>
          <template v-if="state.stagger">
            <StudioField :label="t('perStep')">
              <input type="number" min="1" :value="state.every" @change="apply({ every: +($event.target as HTMLInputElement).value || 1 })">
            </StudioField>
            <StudioField :label="t('nesting')">
              <input type="number" min="1" max="5" :value="state.depth" @change="apply({ depth: +($event.target as HTMLInputElement).value || 1 })">
            </StudioField>
          </template>
        </template>
      </template>
    </section>

    <section class="studio-section">
      <h3 class="studio-section__title">
        {{ t('motion') }}
      </h3>
      <template v-if="canMotion">
        <StudioField :label="t('preset')">
          <select :value="motion ?? ''" @change="applyMotion(($event.target as HTMLSelectElement).value)">
            <option value="">
              {{ t('none') }}
            </option>
            <option v-for="preset in MOTION_PRESETS" :key="preset.id" :value="preset.id">
              {{ t(motionLabels[preset.id]) }}
            </option>
            <!-- A motion written by hand matches no preset. Naming it keeps the
                 control from reading as "None" over an element that moves. -->
            <option v-if="motion === 'custom'" value="custom" disabled>
              {{ t('customMotion') }}
            </option>
          </select>
        </StudioField>
        <StudioField v-if="motion && motion !== 'custom'" :label="t('delay')">
          <input v-model.number="motionDelay" type="number" min="0" step="50" @change="applyMotion(motion!)">
        </StudioField>
      </template>
      <p v-else class="studio-hint">
        {{ t('motionHint') }}
      </p>
    </section>
  </template>

  <section class="studio-section">
    <h3 class="studio-section__title">
      {{ t('slideTransition') }}
    </h3>
    <StudioField :label="t('leaving')">
      <select :value="studio.frontmatter().transition ?? ''" @change="setTransition(($event.target as HTMLSelectElement).value)">
        <option v-for="option in TRANSITIONS" :key="option" :value="option">
          {{ option ? t(transitionLabels[option]) : t('inheritDeck') }}
        </option>
      </select>
    </StudioField>
  </section>
</template>

<style scoped>
.studio-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

/*
 * Sized to the digits it holds so a deck with a dozen steps still lines up,
 * and square-ish rather than round: a step is a position in a sequence, not a
 * bullet.
 */
.studio-step {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--studio-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.12s ease, background 0.12s ease, border-color 0.12s ease;
}

.studio-step:hover { opacity: 1; }

/* Already passed, so it reads as behind you rather than as unavailable. */
.studio-step.is-done {
  opacity: 0.85;
  border-color: var(--studio-accent);
  background: var(--studio-accent-soft);
}

.studio-step.is-current {
  opacity: 1;
  background: var(--studio-accent);
  border-color: var(--studio-accent);
  color: #fff;
}
</style>
