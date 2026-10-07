/**
 * Vitest setup for the standalone package: TSX components render in jsdom, and
 * CSS Modules resolve to identity class maps so a component spec needs no CSS
 * pipeline.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    environment: 'node',
  },
  css: {
    modules: { classNameStrategy: 'non-scoped' },
  },
  resolve: {
    // `.ts`/`.tsx` specifiers in source match the DSH convention; Vite resolves
    // them natively, so no rewrite plugin is needed here.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
})
