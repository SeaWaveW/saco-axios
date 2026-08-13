# @saco/axios

Axios 二次封装。

## 安装

```bash
pnpm add @saco/axios axios
```

`axios` 为 peerDependency，需由业务自行安装。

## 入口

| 入口 | 用途 |
|------|------|
| `@saco/axios` | `src/index.ts` 构建产物 |

```ts
import {} from '@saco/axios'
```

## 开发

```bash
pnpm install
pnpm run dev    # watch 构建
pnpm run build
```

产物在 `es/`（ESM + d.ts）与 `lib/`（CJS）。发布 `files` 不含 `src`。

## License

MIT
