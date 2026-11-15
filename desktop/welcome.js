const status = document.getElementById('status')
const buttons = [...document.querySelectorAll('[data-action]')]
function working(value) {
  document.body.dataset.working = String(value)
  for (const button of buttons) button.disabled = value && button.dataset.action !== 'logs'
}
window.studioDesktop.onStatus(update => {
  status.textContent = update.message
  working(update.working)
})
for (const button of buttons) button.addEventListener('click', async () => {
  if (button.dataset.action !== 'logs') working(true)
  try {
    const result = await window.studioDesktop.perform(button.dataset.action)
    if (result.error) status.textContent = result.error
  }
  catch (error) { status.textContent = error.message }
  finally { working(false) }
})
