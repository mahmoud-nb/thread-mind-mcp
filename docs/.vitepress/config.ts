import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ThreadMind MCP",
  description:
    "Organize AI conversations into thread trees. Think less tokens, think more.",

  // GitHub Pages deploys to /<repo-name>/
  // Update this to match your repository name
  base: "/thread-mind-mcp/",

  head: [
    ["meta", { name: "theme-color", content: "#6d28d9" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "ThreadMind MCP" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Organize AI conversations into thread trees. Reduce token consumption.",
      },
    ],
  ],

  themeConfig: {
    logo: undefined,

    socialLinks: [
      { icon: "github", link: "https://github.com/mahmoud-nb/thread-mind-mcp" },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright 2026 Mahmoud NBET",
    },
  },

  locales: {
    // --- English (default) ---
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Reference", link: "/reference/tools" },
          {
            text: "Changelog",
            link: "https://github.com/mahmoud-nb/thread-mind-mcp/blob/master/CHANGELOG.md",
          },
        ],

        sidebar: {
          "/guide/": [
            {
              text: "Introduction",
              items: [
                { text: "What is ThreadMind?", link: "/guide/what-is-threadmind" },
                { text: "Getting Started", link: "/guide/getting-started" },
              ],
            },
            {
              text: "Core Concepts",
              items: [
                { text: "Projects", link: "/guide/projects" },
                { text: "Threads", link: "/guide/threads" },
                { text: "Context Assembly", link: "/guide/context-assembly" },
                { text: "Team Mode", link: "/guide/team-mode" },
              ],
            },
          ],
          "/reference/": [
            {
              text: "API Reference",
              items: [
                { text: "Tools", link: "/reference/tools" },
                { text: "Resources", link: "/reference/resources" },
                { text: "Storage Format", link: "/reference/storage" },
              ],
            },
          ],
        },
      },
    },

    // --- French ---
    fr: {
      label: "Fran\u00e7ais",
      lang: "fr",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/fr/guide/getting-started" },
          { text: "R\u00e9f\u00e9rence", link: "/fr/reference/tools" },
          {
            text: "Changelog",
            link: "https://github.com/mahmoud-nb/thread-mind-mcp/blob/master/CHANGELOG.md",
          },
        ],

        sidebar: {
          "/fr/guide/": [
            {
              text: "Introduction",
              items: [
                {
                  text: "Qu\u2019est-ce que ThreadMind\u00a0?",
                  link: "/fr/guide/what-is-threadmind",
                },
                { text: "D\u00e9marrage rapide", link: "/fr/guide/getting-started" },
              ],
            },
            {
              text: "Concepts cl\u00e9s",
              items: [
                { text: "Projets", link: "/fr/guide/projects" },
                { text: "Threads", link: "/fr/guide/threads" },
                {
                  text: "Assemblage du contexte",
                  link: "/fr/guide/context-assembly",
                },
                { text: "Mode \u00e9quipe", link: "/fr/guide/team-mode" },
              ],
            },
          ],
          "/fr/reference/": [
            {
              text: "R\u00e9f\u00e9rence API",
              items: [
                { text: "Outils", link: "/fr/reference/tools" },
                { text: "Ressources", link: "/fr/reference/resources" },
                { text: "Format de stockage", link: "/fr/reference/storage" },
              ],
            },
          ],
        },

        outline: { label: "Sur cette page" },
        docFooter: { prev: "Pr\u00e9c\u00e9dent", next: "Suivant" },
        lastUpdated: { text: "Derni\u00e8re mise \u00e0 jour" },
        returnToTopLabel: "Retour en haut",
        sidebarMenuLabel: "Menu",
        darkModeSwitchLabel: "Th\u00e8me",
      },
    },
  },
});
