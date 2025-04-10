# 🎙️ Lemonade Stand Podcast Website

A modern, fast, and SEO-friendly podcast website built with Astro, featuring episode management, dark mode, and a responsive design.

## ✨ Features

- 🚀 Built with Astro for blazing-fast performance
- 🎨 Responsive design with Tailwind CSS
- 🌓 Dark/Light mode toggle
- 📝 Markdown-based episode management
- 📰 RSS feed support

## 🚀 Getting Started

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
├── public/          # Static assets (images, fonts)
├── src/
│   ├── components/  # Reusable Astro components
│   ├── content/     # Episode markdown files
│   ├── layouts/     # Page layouts
│   └── pages/       # Route pages
```

## 📝 Creating Episodes

Episodes are created as Markdown files in `src/content/episodes/`. Use the following template:

```markdown
---
title: "Episode Title"
description: "Episode description"
pubDate: YYYY-MM-DD
youtubeId: "YOUTUBE_VIDEO_ID"
episodeNumber: XX
summary: ""
tags:
  - "Tag 1"
  - "Tag 2"
citations:
  - title: "Citation Title"
    url: "https://example.com/citation"
---

Episode content, show notes, or transcripts go here
```

## 🛠️ Available Commands

| Command           | Action                                      |
|------------------|---------------------------------------------|
| `npm install`    | Install dependencies                        |
| `npm run dev`    | Start dev server at `localhost:4321`        |
| `npm run build`  | Build for production                        |
| `npm run preview`| Preview production build                    |

## 💻 Development

- Built with TypeScript for type safety
- Uses Tailwind CSS for styling
- Content managed through Astro's content collections
- Optimized assets and images

## 📄 License

[MIT License](LICENSE) - feel free to use this for your own podcast website!

---
Built with ❤️ using [Astro](https://astro.build)
