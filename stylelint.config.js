export default {
  extends: ["stylelint-config-standard-scss", "stylelint-config-clean-order"],
  rules: {
    "selector-class-pattern": undefined,
    "scss/selector-class-pattern": [
      "^[a-z0-9]+(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$",
      {
        resolveNestedSelectors: true,
        message: `Селектор не по БЭМ (block__elem--mod)`,
      },
    ],
    "no-descending-specificity": undefined,
    "declaration-block-no-duplicate-properties": true,
    "no-duplicate-selectors": true,
    "scss/dollar-variable-pattern": "^[a-z-]+$",
    "scss/at-extend-no-missing-placeholder": true,
    "max-nesting-depth": [
      2,
      {
        ignore: ["blockless-at-rules", "pseudo-classes"],
      },
    ],
    "color-named": undefined,
    "font-weight-notation": undefined,
    "alpha-value-notation": undefined,
    "hue-degree-notation": undefined,
  },
};
