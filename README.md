# @saco/axios

Axios 二次封装：统一请求 / 响应处理，可选双 token（401 单飞刷新、后续请求排队）。


## 安装

```bash
pnpm add @saco/axios
```

`axios` 已作为依赖随包装上，无需再单独安装。


## 基础用法

`createAxios(options)`。同时支持 axios `create` 的全部默认项（`baseURL`、`timeout`、`headers` 等）。


| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `requestHandler` | `(config) => config` | 请求拦截，业务自行处理 |
| `successHandler` | `(response, resolve, reject) => void` | 无对应 `codeMaps` 时的成功统一处理 |
| `codeMaps` | `{ [code: number]: successHandler }` | 按 `response.data.code` 分流 |
| `errorHandler` | `(error) => any` | 失败统一处理。跳登录需自行判断并做成幂等 |


```ts
import { createAxios } from '@saco/axios'

export const http = createAxios({
  baseURL: '/api',
  timeout: 10000,
  requestHandler(config) {
    return config
  },
  successHandler(response, resolve, reject) {
    const { code, data, message } = response.data
    if (code === 0) resolve(data)
    else reject(new Error(message))
  },
  codeMaps: {
    10001(response, resolve, reject) {
      reject(new Error(response.data.message))
    },
  },
  errorHandler(error) {
    return error
  },
})

export const getUser = () => http.get('/user/info')
```


## 双 token

`dualMode: true` 时以下字段必填。`accessToken` / `refreshToken` 是字段名，不是 token 值。库只负责排队和重试；挂请求头在 `requestHandler`，刷新后写存储在 `refreshTokenHandler`。


| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `dualMode` | `true` | 启用双 token |
| `accessToken` | `string` | 访问令牌（短期）字段名 |
| `refreshToken` | `string` | 刷新令牌（长期）字段名 |
| `refreshTokenApi` | `string` | 刷新接口地址，用于识别刷新请求、避免死锁 |
| `refreshTokenHandler` | `(instance, refreshToken, accessToken) => Promise<unknown>` | 用传入的 `instance` 发刷新请求，后两个参数是字段名。后端 Set-Cookie 可直接 `return instance.post(url)`；token 在 `data` 里则 `await` 后按字段名写入存储 |

刷新地址必须抽成**常量**，同时给 `refreshTokenApi`、`refreshTokenHandler` 和 `errorHandler` 里的判断使用。两处各写一遍字符串，一旦改漏，库认不出刷新接口，请求拦截会 `waitIfRefreshing` 等自己，死锁。

短 / 长 token 怎么更新是业务的事，库不管。两种后端常见写法：


```ts
export const refreshUrl = '/auth/refresh'

export const http = createAxios({
  baseURL: '/api',
  dualMode: true,
  accessToken: 'Authorization',
  refreshToken: 'X-Refresh-Token',
  refreshTokenApi: refreshUrl,
  // 1. 后端直接 Set-Cookie：发请求即可，浏览器会带上新 Cookie
  refreshTokenHandler: (instance) => instance.post(refreshUrl),
  // 2. token 在 data 里：await 之后按字段名写入存储
  // refreshTokenHandler: async (instance, refreshToken, accessToken) => {
  //   const data = await instance.post(refreshUrl)
  //   // 用 refreshToken / accessToken 字段名把 data 里的长短 token 写回存储
  // },
  errorHandler(error) {
    if (error.config?.url?.includes(refreshUrl)) {
      // 刷新接口失败：清登录态 / 跳登录（注意幂等）
    }
    return error
  },
})
```

行为简述：

- 已在途的请求 401：共用同一次 `refresh()`，完成后重试一次
- 刷新进行中、尚未发出的请求：在请求拦截里排队，刷新完成后再发
- 刷新接口本身不排队、不递归刷新
- 刷新失败：`reject` 给 `errorHandler`，该请求不会再发出 / 重试

`refreshTokenHandler` 必须用传入的 `instance` 发请求，URL 须能被 `refreshTokenApi` 匹配（`url.includes(refreshTokenApi)`）。

登录跳转放 `errorHandler`，用 `refreshUrl` 判断是否刷新接口失败；不要放进 `refreshTokenHandler`。`errorHandler` 还会接到其它失败（500、断网、取消），不要一律跳登录。


## License

MIT
