const status = document.getElementById('status')
const progress = document.getElementById('progress-bar')
const elapsed = document.getElementById('elapsed')
const detail = document.getElementById('detail')
const buttons = [...document.querySelectorAll('[data-action]')]
let startedAt = 0
let timer = null
function updateElapsed() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000)
  elapsed.textContent = `已用时 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
function working(value) {
  document.body.dataset.working = String(value)
  progress.hidden = !value
  elapsed.hidden = !value
  detail.hidden = !value || !detail.textContent
  if (value && timer === null) {
    startedAt = Date.now()
    updateElapsed()
    timer = setInterval(updateElapsed, 1000)
  }
  else if (!value && timer !== null) {
    clearInterval(timer)
    timer = null
  }
  for (const button of buttons) button.disabled = value && button.dataset.action !== 'logs'
}
window.studioDesktop.onStatus(update => {
  status.textContent = update.message
  detail.textContent = update.detail || ''
  progress.setAttribute('aria-valuetext', update.message)
  working(update.working)
})
for (const button of buttons) button.addEventListener('click', async () => {
  const projectAction = button.dataset.action !== 'logs'
  if (projectAction) working(true)
  try {
    const result = button.dataset.action === 'studioUpdate'
      ? await window.studioDesktop.studioUpdate()
      : await window.studioDesktop.perform(button.dataset.action)
    if (result.error) status.textContent = result.error
  }
  catch (error) { status.textContent = error.message }
  finally { if (projectAction) working(false) }
})
