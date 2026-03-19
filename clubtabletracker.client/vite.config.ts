import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';
import { env } from 'process';

const targetFromAspNetCoreUrls = env.ASPNETCORE_URLS
    ? env.ASPNETCORE_URLS.split(';').find(url => url.startsWith('http://'))
    : undefined;

const target = targetFromAspNetCoreUrls ?? 'http://localhost:5037';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        proxy: {
            '^/weatherforecast': {
                target,
                secure: false
            }
        },
        port: parseInt(env.DEV_SERVER_PORT || '57194')
    }
})
