<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { QuizOption } from '../../../shared/quiz'
import type { ButtonAction } from '../../md/interactions'
import type { MessageKey } from '../../i18n'
import { useStudio } from '../../context'
import { action, t } from '../../i18n'
import { listQuestions, patchInteraction, readInteraction, setButtonAction } from '../../md/interactions'
import { activePanel, busy, editing, inspectorVisible, selection } from '../../state'
import { imagePending } from '../../composables/useImageInsertion'
import StudioField from './StudioField.vue'
import ColorSwatch from './ColorSwatch.vue'

const studio = useStudio()
const range = computed(() => selection.value?.range)
const form = computed(() => range.value ? readInteraction(studio.content(), range.value) : null)
const locked = computed(() => busy.value || editing.value || imagePending.value)
const questions = computed(() => listQuestions(studio.content()).filter((item, _index, all) => item.value.question
  && all.filter(other => other.value.question === item.value.question).length === 1))
const controller = computed(() => form.value?.kind === 'question' && range.value ? { range: range.value, value: form.value }
  : questions.value.find(item => item.value.question === form.value?.question))
const actions = computed<{ value: ButtonAction, label: MessageKey }[]>(() => [
  { value: controller.value?.value.mode === 'multiple' ? 'set-option' : 'choose', label: 'quizChooseOption' },
  ...(controller.value?.value.mode === 'multiple' ? [{ value: 'submit' as const, label: 'quizSubmit' as const }] : []),
  { value: 'clear-pending', label: 'quizClear' },
])
const colors = [
  { name: 'fill', label: 'quizNormalFill' }, { name: 'color', label: 'quizTextColor' },
  { name: 'selectedFill', label: 'quizSelectedFill' }, { name: 'correctFill', label: 'quizCorrectFill' },
  { name: 'incorrectFill', label: 'quizIncorrectFill' },
] as const
const previewModes = [{ value: 'normal', label: 'quizPreviewNormal' }, { value: 'selected', label: 'quizPreviewSelected' }, { value: 'correct', label: 'quizPreviewCorrect' }, { value: 'incorrect', label: 'quizPreviewIncorrect' }] as const
const previewMode = ref('normal')
function preview(value: string) {
  previewMode.value = value
  selection.value?.el.dispatchEvent(new CustomEvent('studio-button-preview', { detail: value }))
}
watch(() => selection.value?.el, (_next, previous) => {
  previous?.dispatchEvent(new CustomEvent('studio-button-preview', { detail: 'normal' }))
  previewMode.value = 'normal'
}, { flush: 'sync' })
onScopeDispose(() => selection.value?.el.dispatchEvent(new CustomEvent('studio-button-preview', { detail: 'normal' })))

async function patch(values: Record<string, string | number | QuizOption[] | null>) {
  if (locked.value || !range.value) return
  await studio.commit(patchInteraction(studio.content(), range.value, values), action('actionQuizEdit'))
}
async function setController(values: Record<string, string | QuizOption[]>) {
  if (locked.value || !controller.value) return
  await studio.commit(patchInteraction(studio.content(), controller.value.range, values), action('actionQuizEdit'))
}
function correct(id: string, checked: boolean) {
  const question = controller.value?.value
  if (question?.options) return setController({ options: question.options.map(option => ({ ...option, correct: question.mode === 'single' ? option.id === id : option.id === id ? checked : option.correct })) })
}
function changeQuestion(id: string) {
  const target = questions.value.find(item => item.value.question === id)?.value
  if (!target || form.value?.kind !== 'button') return patch({ question: id })
  const current = form.value
  const optionAction = current.action === 'choose' || current.action === 'set-option' || current.action === 'submit' && target.mode === 'single'
  return patch({ question: id,
    ...(optionAction ? { action: target.mode === 'multiple' ? 'set-option' : 'choose', option: target.options?.find(option => option.id === current.option)?.id ?? target.options?.[0]?.id ?? '' } : {}),
  })
}
async function changeAction(value: string) {
  if (locked.value || !range.value) return
  const next = setButtonAction(studio.content(), range.value, value as ButtonAction)
  await studio.commit(next, action('actionQuizEdit'))
}
function radius(value: string) {
  const number = Number(value)
  if (value.trim() && Number.isFinite(number) && number >= 0) return patch({ radius: number })
}
async function goToControl() {
  if (locked.value || !controller.value) return
  if (await studio.selectInserted('StudioQuestion', controller.value.range)) {
    activePanel.value = 'inspect'
    inspectorVisible.value = true
  }
}
</script>

<template>
  <fieldset class="studio-interaction-fields" :disabled="locked">
    <p v-if="!form" class="studio-hint">{{ t('quizAdvancedHint') }}</p>
    <template v-else>
      <StudioField v-if="form.kind !== 'question'" :label="t('quizBelongsTo')">
        <select :value="form.question ?? ''" :disabled="form.question === null" @change="changeQuestion(($event.target as HTMLSelectElement).value)">
          <option value="" disabled>{{ t('quizChooseQuestion') }}</option>
          <option v-for="question in questions" :key="question.value.question!" :value="question.value.question!">{{ question.value.name || question.value.question || t('quizUntitled') }}</option>
        </select>
      </StudioField>
      <p v-if="form.kind !== 'question' && !controller" class="studio-hint">{{ t('quizMissingQuestion') }}</p>
      <button v-if="form.kind !== 'question' && controller" type="button" class="studio-button" @click="goToControl">{{ t('quizGoToControl') }}</button>

      <template v-if="form.kind === 'question'">
        <p class="studio-hint">{{ t('quizControlHint') }}</p>
        <StudioField :label="t('quizControlName')"><input type="text" :value="form.name ?? ''" :disabled="form.name === null" @change="patch({ name: ($event.target as HTMLInputElement).value })"></StudioField>
        <StudioField :label="t('quizShowInPresentation')"><input type="checkbox" :checked="form.presentation === 'summary'" :disabled="form.presentation === null" @change="patch({ presentation: ($event.target as HTMLInputElement).checked ? 'summary' : 'hidden' })"></StudioField>
        <StudioField :label="t('quizType')"><span>{{ t(form.mode === null ? 'quizAdvancedValue' : form.mode === 'multiple' ? 'quizMultiple' : 'quizSingle') }}</span></StudioField>
        <div v-if="form.options && form.mode" class="studio-quiz-options">
          <strong>{{ t('quizOptionsAndAnswers') }}</strong>
          <label v-for="option in form.options" :key="option.id" class="studio-quiz-option">
            <input :type="form.mode === 'single' ? 'radio' : 'checkbox'" :checked="option.correct" name="studio-quiz-answer" :aria-label="t('quizCorrectOption', { option: option.id })" @change="correct(option.id, ($event.target as HTMLInputElement).checked)">
            <span>{{ option.id }}</span>
          </label>
          <p class="studio-hint">{{ t('quizAnswerHint') }}</p>
        </div>
        <p v-else class="studio-hint">{{ t('quizAdvancedHint') }}</p>
      </template>

      <template v-if="form.kind === 'button'">
        <StudioField :label="t('quizButtonAction')"><select :value="form.action ?? ''" :disabled="form.action === null || !controller?.value.mode" @change="changeAction(($event.target as HTMLSelectElement).value)"><option v-for="item in actions" :key="item.value" :value="item.value">{{ t(item.label) }}</option></select></StudioField>
        <p class="studio-hint">{{ t('quizActionTextHint') }}</p>
        <StudioField v-if="form.action === 'choose' || form.action === 'set-option'" :label="t('quizButtonOption')"><select :value="form.option ?? ''" :disabled="form.option === null || !controller?.value.options" @change="patch({ option: ($event.target as HTMLSelectElement).value })"><option v-for="option in controller?.value.options ?? []" :key="option.id" :value="option.id">{{ option.id }}</option></select></StudioField>
        <StudioField v-for="field in colors" :key="field.name" :label="t(field.label)"><ColorSwatch v-if="form[field.name] !== null" :value="form[field.name]!" @change="patch({ [field.name]: $event })" /><span v-else>{{ t('quizAdvancedValue') }}</span></StudioField>
        <StudioField :label="t('quizRadius')"><input type="number" min="0" :value="form.radius ?? ''" :disabled="form.radius === null" @change="radius(($event.target as HTMLInputElement).value)"></StudioField>
        <p class="studio-hint">{{ t('quizAppearancePreview') }}</p>
        <div class="studio-quiz-preview"><button v-for="mode in previewModes" :key="mode.value" type="button" :aria-pressed="previewMode === mode.value" @click="preview(mode.value)">{{ t(mode.label) }}</button></div>
      </template>

      <template v-if="form.kind === 'feedback'">
        <StudioField :label="t('quizFeedbackEffect')"><select :value="form.effect ?? ''" :disabled="form.effect === null" @change="patch({ effect: ($event.target as HTMLSelectElement).value })"><option value="none">{{ t('quizEffectNone') }}</option><option value="fade">{{ t('quizEffectFade') }}</option><option value="pop">{{ t('quizEffectPop') }}</option></select></StudioField>
      </template>

    </template>
  </fieldset>
</template>
