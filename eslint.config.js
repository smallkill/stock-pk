import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["**/dist/**", "**/.wrangler/**", "**/node_modules/**", "**/.astro/**"] },
  ...tseslint.configs.recommended,
);
