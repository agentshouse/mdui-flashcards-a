import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    {name: 'house-local-markdown-help', enforce: 'pre', transform(source, id) {
      if (id.replaceAll('\\', '/').includes('/@uiw/react-md-editor/esm/commands/help.js')) {
        const external = 'https://www.markdownguide.org/basic-syntax/';
        if (!source.includes(external)) throw new Error('Review changed Markdown help command before building.');
        return source.replaceAll(external, './markdown-help.html');
      }
    }},
    react(), tailwindcss(),
  ],
})
