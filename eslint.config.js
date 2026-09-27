import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  { ignores: ["dist/**", "dist-server/**", "outputs/**", "node_modules/**", ".next/**", "generated_images/**", "upload/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["src/**/*.{ts,vue}"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, sourceType: "module", extraFileExtensions: [".vue"] },
      globals: { window: "readonly", document: "readonly", localStorage: "readonly", navigator: "readonly", confirm: "readonly", clearTimeout: "readonly", setTimeout: "readonly", FileReader: "readonly", Blob: "readonly", URL: "readonly", Event: "readonly", HTMLInputElement: "readonly", HTMLSelectElement: "readonly" }
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/html-self-closing": "off",
      "vue/require-v-for-key": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/mustache-interpolation-spacing": "off",
      "vue/html-closing-bracket-spacing": "off",
      "vue/html-indent": "off",
      "vue/attributes-order": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
