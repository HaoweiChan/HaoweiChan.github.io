# Haowei Chan

🌐 **Live Website**: [https://haoweichan.github.io](https://haoweichan.github.io) (繁體中文版: [https://haoweichan.github.io/zh-tw/](https://haoweichan.github.io/zh-tw/))

Personal portfolio and blog for Haowei Chan, built with Astro's official blog template.

Features:

- Minimal portfolio homepage
- Markdown and MDX blog content collections
- English and Traditional Chinese routes with a static language switch
- SEO metadata, sitemap, and RSS feed
- Static build output suitable for GitHub Pages

## Project Structure

Key folders and files:

```text
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── README.md
├── package.json
└── tsconfig.json
```

Blog posts live in `src/content/blog/`. Traditional Chinese translations live in
`src/content/blog/zh-tw/` and use the `translationOf` frontmatter field to pair routes.
Routes live in `src/pages/`.

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Credit

Initialized with Astro's official blog template.
