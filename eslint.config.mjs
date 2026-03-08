import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:contract',
              onlyDependOnLibsWithTags: ['scope:contract'],
            },
            {
              sourceTag: 'scope:runtime',
              onlyDependOnLibsWithTags: ['scope:contract', 'scope:runtime'],
            },
            {
              sourceTag: 'scope:session',
              onlyDependOnLibsWithTags: [
                'scope:contract',
                'scope:runtime',
                'scope:session',
              ],
            },
            {
              sourceTag: 'scope:react',
              onlyDependOnLibsWithTags: [
                'scope:contract',
                'scope:session',
                'scope:react',
              ],
            },
            {
              sourceTag: 'scope:angular',
              onlyDependOnLibsWithTags: [
                'scope:contract',
                'scope:runtime',
                'scope:session',
                'scope:angular',
              ],
            },
            {
              sourceTag: 'scope:playground',
              onlyDependOnLibsWithTags: [
                'scope:contract',
                'scope:runtime',
                'scope:session',
                'scope:react',
              ],
            },
            {
              sourceTag: 'scope:demo',
              onlyDependOnLibsWithTags: [
                'scope:contract',
                'scope:session',
                'scope:react',
              ],
            },
            {
              sourceTag: 'scope:async',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:async'],
            },
            {
              sourceTag: 'scope:colors',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:colors'],
            },
            {
              sourceTag: 'scope:strings',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:strings'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];
