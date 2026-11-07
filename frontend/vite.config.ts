import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({plugins:[react(),tailwindcss(),VitePWA({registerType:'prompt',manifest:{name:'Know Your Place',short_name:'Know Your Place',lang:'tr',description:'Kişisel finans kontrol merkezi',start_url:'/',display:'standalone',background_color:'#f5f6fc',theme_color:'#131b2e',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},workbox:{navigateFallbackDenylist:[/^\/api/],globPatterns:['**/*.{js,css,html,png,jpg,woff2,webmanifest}'],runtimeCaching:[]}})],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},server:{proxy:{'/api':'http://localhost:5080','/health':'http://localhost:5080'}}});
