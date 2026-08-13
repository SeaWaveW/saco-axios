import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function emptyDir(dir: string) {
    const abs = path.resolve(__dirname, dir)
    fs.rmSync(abs, { recursive: true, force: true })
    fs.mkdirSync(abs, { recursive: true })
}

export default defineConfig({
    plugins: [
        {
            name: 'saco-axios:empty-out-dirs',
            buildStart() {
                emptyDir('es')
                emptyDir('lib')
            },
        },
        dts({
            include: ['src'],
            outDir: 'es',
            entryRoot: 'src',
            rollupTypes: false,
            tsconfigPath: path.resolve(__dirname, 'tsconfig.json'),
        }),
    ],
    build: {
        lib: {
            entry: {
                index: path.resolve(__dirname, 'src/index.ts'),
            },
            formats: ['es', 'cjs'],
        },
        rollupOptions: {
            external: ['axios'],
            output: [
                {
                    format: 'es',
                    dir: 'es',
                    preserveModules: true,
                    preserveModulesRoot: 'src',
                    entryFileNames: '[name].mjs',
                    exports: 'named',
                },
                {
                    format: 'cjs',
                    dir: 'lib',
                    preserveModules: true,
                    preserveModulesRoot: 'src',
                    entryFileNames: '[name].cjs',
                    exports: 'named',
                },
            ],
        },
        sourcemap: true,
        minify: true,
        emptyOutDir: false,
    },
})
