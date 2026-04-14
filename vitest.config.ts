export default {
  test: {
    environment: 'node'
  },
  ssr: {
    noExternal: ['node:sqlite']
  },
  optimizeDeps: {
    include: ['node:sqlite']
  }
}
