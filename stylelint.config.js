export default {
  extends: 'stylelint-config-standard',
  rules: {
    'custom-property-pattern': null,
    'selector-class-pattern': null,
    // The whole codebase pairs camelCase DOM ids between HTML/CSS/JS
    // (coreButton, statusLabel, ...) — a consistent existing convention,
    // not an inconsistency to "fix".
    'selector-id-pattern': null,
    'no-descending-specificity': null,
    // Both notations mean the same thing; traditional prefix notation has
    // wider legacy support and matches what was already here.
    'media-feature-range-notation': 'prefix',
  },
  overrides: [
    {
      // Untouched-on-purpose in the Phase 0 refactor (see main.css's header
      // comment) — its handful of compact one-line rules get reformatted
      // when Phase 1 rebuilds this file around design tokens, not before.
      files: ['src/styles/main.css'],
      rules: {
        'declaration-block-single-line-max-declarations': null,
      },
    },
  ],
};
