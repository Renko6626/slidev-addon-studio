import { readFileSync } from 'node:fs'
import { compileScript, parse } from 'vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import type { Component } from 'vue'

/** Exercise real Vue components without changing the repository's Vite setup. */
export function loadVueComponent(file: string, modules: Record<string, unknown>): Component {
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
  const compiled = compileScript(descriptor, { id: file, inlineTemplate: true })
  const code = compiled.content.replaceAll('import.meta.env.BASE_URL', JSON.stringify(import.meta.env.BASE_URL))
  const script = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText
  const exports: { default?: Component } = {}
  const available = { vue: Vue, ...modules }
  new Function('require', 'exports', script)((name: string) => {
    if (!(name in available)) throw new Error(`Unexpected component import ${name}`)
    return available[name as keyof typeof available]
  }, exports)
  return exports.default!
}
