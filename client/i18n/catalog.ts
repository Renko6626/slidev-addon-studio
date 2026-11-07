import type { CatalogComponent, PropMeta } from '../types'
import type { MessageKey } from './index'
import en from './en'
import { t } from './index'

// These labels are supplied by Studio's node/builtin-meta.ts, rather than by
// component authors. Match both the builtin identity and original label so
// metadata supplied by a project, theme or addon keeps its own wording.
const builtinPropLabels: Record<string, Record<string, MessageKey>> = {
  Arrow: {
    x1: 'builtinStartX', y1: 'builtinStartY', x2: 'builtinEndX', y2: 'builtinEndY',
    width: 'builtinThickness', color: 'builtinColour', twoWay: 'builtinTwoWay',
  },
  AutoFitText: {
    modelValue: 'kindText', max: 'builtinLargestSize', min: 'builtinSmallestSize', multiLine: 'builtinWrapLines',
  },
  BlueSky: { uri: 'builtinPostUrl', scale: 'builtinScale' },
  Link: { to: 'builtinSlidePath', title: 'builtinLinkText' },
  SlidevVideo: {
    autoplay: 'builtinAutoplay', autoreset: 'builtinRewind', poster: 'builtinPoster',
    printPoster: 'builtinPrintPoster', timestamp: 'builtinStartTime',
    printTimestamp: 'builtinPrintFrame', controls: 'builtinControls',
  },
  Toc: {
    columns: 'builtinColumns', maxDepth: 'builtinMaxDepth', minDepth: 'builtinMinDepth',
    mode: 'builtinShow', start: 'builtinStartLevel',
  },
  Transform: { scale: 'builtinScale', origin: 'builtinOrigin' },
  Tweet: {
    id: 'builtinTweetId', scale: 'builtinScale', conversation: 'builtinConversation', cards: 'builtinMediaCards',
  },
  Youtube: { id: 'builtinVideoId', width: 'width', height: 'height' },
}

const builtinOptionLabels: Record<string, Record<string, Record<string, MessageKey>>> = {
  SlidevVideo: {
    autoplay: { true: 'yes', false: 'no', once: 'builtinOnce' },
    autoreset: { slide: 'withSlide', click: 'onClick' },
  },
  Toc: { mode: { all: 'builtinAll', onlyCurrentTree: 'builtinCurrentTree', onlySiblings: 'builtinSiblings' } },
  Tweet: { cards: { visible: 'builtinVisible', hidden: 'builtinHidden' } },
}

export function catalogPropLabel(component: Pick<CatalogComponent, 'name' | 'source'>, prop: Pick<PropMeta, 'name' | 'label'>): string {
  const key = component.source === 'builtin' ? builtinPropLabels[component.name]?.[prop.name] : undefined
  return key && prop.label === en[key] ? t(key) : prop.label ?? prop.name
}

export function catalogOptionLabel(component: Pick<CatalogComponent, 'name' | 'source'>, prop: Pick<PropMeta, 'name' | 'label'>, value: string): string {
  const labelKey = builtinPropLabels[component.name]?.[prop.name]
  const key = component.source === 'builtin' && labelKey && prop.label === en[labelKey]
    ? builtinOptionLabels[component.name]?.[prop.name]?.[value]
    : undefined
  return key ? t(key) : value
}

export function catalogOrigin(item: Pick<CatalogComponent, 'source' | 'origin'>): string {
  return item.source === 'project' && item.origin === 'Project' ? t('project') : item.origin
}

export function catalogDescription(component: Pick<CatalogComponent, 'name' | 'source' | 'description'>): string | undefined {
  return component.source === 'builtin' && component.name === 'SlidevVideo' && component.description === en.builtinVideoDescription
    ? t('builtinVideoDescription')
    : component.description
}
