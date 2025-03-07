
npm install 

npm install axios

npm install react-router-dom 

# TAILWINDCSS SETUP 

npm install tailwindcss @tailwindcss/vite

# vite.config.js
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
})

# index.css
@import "tailwindcss";