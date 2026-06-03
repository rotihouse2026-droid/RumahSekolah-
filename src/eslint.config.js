import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*']
  },
  {
    files: ['firestore.rules'],
    ...firebaseRulesPlugin.configs['flat/recommended']
  }
];
