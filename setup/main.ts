import type { AppContext } from '@slidev/types'
import { installStudioRuntime } from '../runtime/app'

export default function setupStudioRuntime({ app }: AppContext): void {
  installStudioRuntime(app)
}
