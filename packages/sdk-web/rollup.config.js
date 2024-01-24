import ts from '@rollup/plugin-typescript'

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'esm',
    },
    plugins: [
      ts({
        // TODO: dir structure of type will be ugly
        include: ['src/**/*.ts+(|x)', '../../shared/**/*.ts+(|x)'],
      }),
    ],
    external: ['socket.io-client', 'mediasoup-client'],
  },
]
