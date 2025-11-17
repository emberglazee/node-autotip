import stylistic from '@stylistic/eslint-plugin'

export default [
    {
        rules: {
            'no-trailing-spaces': 'error',
            'eol-last': 'error',
            '@stylistic/semi': ['error', 'never'],
            'no-async-promise-executor': 'off',
            'no-case-declarations': 'off',
            'arrow-parens': ['error', 'as-needed'],
            'comma-dangle': ['error', 'never'],
            '@stylistic/member-delimiter-style': ['error', {
                multiline: {
                    delimiter: 'none',
                    requireLast: false
                },
                singleline: {
                    delimiter: 'comma',
                    requireLast: false
                }
            }],
            '@stylistic/space-infix-ops': ['error'],
            'space-before-function-paren': ['error', {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always'
            }],
            'quotes': [
                'error', 'single',
                { avoidEscape: true }
            ],
            '@stylistic/indent': ['error', 4]
        },
        plugins: {
            '@stylistic': stylistic
        }
    }
]
