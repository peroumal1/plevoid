import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    tsconfig: './tsconfig.test.json',
  },
})
