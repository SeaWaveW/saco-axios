# @saco/axios

Axios 二次封装：统一请求 / 响应处理，可选双 token（401 单飞刷新、后续请求排队、按时间提前刷新）。


## 安装

```bash
pnpm add @saco/axios
```

`axios` 已作为依赖随包装上，无需再单独安装。


## 基础用法

`createAxios(options)`。同时支持 axios `create` 的全部默认项（`baseURL`、`timeout`、`headers` 等）。


| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `requestHandler` | `(config) => config` | 可选。传入后才走自定义请求拦截 |
| `successHandler` | `(response, resolve, reject) => void` | 可选。传入后，且没有命中 `codeMaps` 时，才走统一成功处理 |
| `codeMaps` | `{ [code: number]: successHandler }` | 可选。传入后才按 `response.data.code` 分流；未命中的 code 仍走 `successHandler` |
| `errorHandler` | `(error) => any` | 可选。传入后才走统一失败处理。跳登录需自行判断并做成幂等 |


```ts
import { createAxios } from '@saco/axios'

export const http = createAxios({
  baseURL: '/api',
  timeout: 10000,
  // 可选；传入后才走自定义请求拦截
  requestHandler(config) {
    return config
  },
  // 可选；传入后，且没有命中 codeMaps 时，才走统一成功处理
  successHandler(response, resolve, reject) {
    const { code, data, message } = response.data
    if (code === 0) resolve(data)
    else reject(new Error(message))
  },
  // 可选；传入后，才按 response.data.code 分流；未命中的 code 仍走 successHandler
  codeMaps: {
    10001(response, resolve, reject) {
      reject(new Error(response.data.message))
    },
  },
  // 可选；传入后才走统一失败处理
  errorHandler(error) {
    return error
  },
})

export const getUser = () => http.get('/user/info')
```


## 双 token

`dualMode: true` 时以下字段必填：`accessToken`、`refreshToken`、`refreshTokenApi`、`refreshTokenHandler`。

`accessToken` / `refreshToken` / `expires` 是**字段名**（存储 key；access 同时作为请求头名），不是 token 值。必须抽成**常量**，和 `refreshTokenApi` 一样：创建实例、写入存储、`refreshTokenHandler` 里都引用同一份，避免拼写不一致导致读不到令牌。`expires` 不传时默认为 `{accessToken}_expiresTime`。

库负责：排队、401 单飞刷新、按时间提前刷新；默认从 `localStorage` 读 access 并挂头。

业务负责：登录 / 刷新后把新 token **写入存储**，并用 `setExpiresTime` 写入失效时间戳。


### 创建配置


| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `dualMode` | `true` | 启用双 token |
| `accessToken` | `string` | 访问令牌字段名：存储 key + 请求头名 |
| `refreshToken` | `string` | 刷新令牌字段名：存储 key |
| `tokenStorage` | `'cookie' \| 'localStorage'` | 可选，默认 `'localStorage'`。每次请求按字段名读取 access 并挂头。部分安卓 WebView 拿不到 Cookie，故默认不走 cookie |
| `refreshTokenApi` | `string` | 刷新接口地址，用于识别刷新请求、避免死锁 |
| `refreshTokenHandler` | `(instance, refreshToken, accessToken, expires) => Promise<unknown>` | 用传入的 `instance` 发刷新请求。后三个参数都是**存储字段名**：refresh、access、失效时间（`expires` 默认 `{accessToken}_expiresTime`） |
| `expires` | `string` | 可选。失效时间戳的存储字段名，默认 `{accessToken}_expiresTime` |
| `expiresTime` | `number` | 可选。失效**时间戳**，单位毫秒（与 `Date.now()` 同一量级，如 `1710000000000`）。不要传剩余时长，也不要 `Date.now() + ttl`。创建时可先不传 |
| `checkTokenTime` | `number` | 可选。提前检查阈值，单位毫秒。每次请求：`Date.now() + checkTokenTime >= expiresTime` 则主动刷新。例如 `60 * 1000` 表示提前 1 分钟。不传视为 `0` |


`tokenStorage: 'cookie'` 会打开 `withCredentials`。HttpOnly Cookie **读不到值**，也**读不到过期时间**，此时只靠浏览器自动带 Cookie。

`accessToken`、`refreshToken`、`expires`、刷新地址都必须抽成**常量**，同时给 `createAxios`、写入存储、`refreshTokenHandler` 和 `errorHandler` 使用。各写一遍字符串，一旦拼错，库读不到令牌或认不出刷新接口（请求拦截会 `waitIfRefreshing` 等自己，死锁）。

`refreshTokenHandler` 必须用传入的 `instance` 发请求，URL 须能被 `refreshTokenApi` 匹配（`url.includes(refreshTokenApi)`）。


### 实例方法

`http.setExpiresTime(validTime, leadTime?)`

| 参数 | 单位 | 说明 |
| --- | --- | --- |
| `validTime` | 毫秒时间戳 | 后端返回的**失效时间点**，如 `1710000000000`。不是剩余时长，不要与 `Date.now()` 相加 |
| `leadTime` | 毫秒 | 提前检查阈值，写入 `checkTokenTime`。不传则沿用创建时的值 |

会写入内存，并按 `tokenStorage` 缓存（默认 localStorage，key 为 `expires`，缺省 `{accessToken}_expiresTime`）。刷新页面后 `createAxios` 会读回，每次请求也从存储读取。登录成功、刷新成功后都要调用。JWT 的 `exp` 若是秒，业务侧先 `* 1000` 再传入。退出登录时记得删掉这个 key。


### 单次请求：`requireAuth`

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `requireAuth` | `true` | `false`：不挂令牌、不按时间刷新、401 也不走双 token 刷新，请求原样发出 |

登录、注册、验证码等接口应传 `requireAuth: false`。后端通常不校验令牌，但密码错误仍可能返回 401，库会把它当成令牌过期去刷新。

字段不叫 `auth`：axios 已用 `auth` 表示 HTTP Basic（`username` / `password`）。


```ts
http.post('/login', data, { requireAuth: false })
http.post('/register', data, { requireAuth: false })
```


### 示例

```ts
export const accessTokenKey = 'accessToken'
export const refreshTokenKey = 'refreshToken'
export const expiresTimeKey = `${accessTokenKey}_expiresTime`
export const refreshUrl = '/auth/refresh'

export const http = createAxios({
  baseURL: '/api',
  dualMode: true,
  // tokenStorage 默认 localStorage；安卓 WebView 往往拿不到 Cookie
  accessToken: accessTokenKey,
  refreshToken: refreshTokenKey,
  expires: expiresTimeKey, // 可选，默认 `${accessToken}_expiresTime`
  checkTokenTime: 60 * 1000,
  refreshTokenApi: refreshUrl,
  // 1. 后端直接 Set-Cookie：发请求即可，浏览器会带上新 Cookie
  // refreshTokenHandler: (instance) => instance.post(refreshUrl),
  // 2. token 在 data 里：写入存储，并更新失效时间戳
  refreshTokenHandler: async (instance, refreshToken, accessToken, expires) => {
    const data = await instance.post(refreshUrl)
    localStorage.setItem(accessToken, data.accessToken)
    localStorage.setItem(refreshToken, data.refreshToken)
    http.setExpiresTime(data.expireAt) // 写入 expires 对应的存储 key
  },
  errorHandler(error) {
    if (error.config?.url?.includes(refreshUrl)) {
      localStorage.removeItem(accessTokenKey)
      localStorage.removeItem(refreshTokenKey)
      localStorage.removeItem(expiresTimeKey)
      window.location.href = '/login'
    }
    return error
  },
})

export const login = (data: LoginParams) => {
  return http.post('/login', data, { requireAuth: false }).then((res) => {
    localStorage.setItem(accessTokenKey, res.accessToken)
    localStorage.setItem(refreshTokenKey, res.refreshToken)
    http.setExpiresTime(res.expireAt, 60 * 1000)
    return res
  })
}

export const getUser = () => http.get('/user/info')
```


### 行为

- 已在途的请求 401：共用同一次 `refresh()`，完成后重试一次
- 刷新进行中、尚未发出的请求：在请求拦截里排队，刷新完成后再发
- 每次请求从 `tokenStorage` 读取当前 `expiresTime`（毫秒时间戳）：`Date.now() + checkTokenTime >= expiresTime` 则主动刷新。未 `setExpiresTime` 或非正数则跳过。`setExpiresTime` 会缓存，刷新页面后自动读回
- 默认从 `localStorage` 读取 access 挂到请求头（`tokenStorage: 'cookie'` 时改走 Cookie）。头名为 `accessToken` 字段名；若为 `Authorization` 且值未带 `Bearer` 会自动补上。存储里没值则不挂头
- 刷新接口本身不排队、不递归刷新、不挂 access
- `requireAuth: false`：不挂令牌、不排队、不刷新，401 原样抛给 `errorHandler`
- 刷新失败：`reject` 给 `errorHandler`，该请求不会再发出 / 重试

登录跳转放 `errorHandler`，用 `refreshUrl` 判断是否刷新接口失败；不要放进 `refreshTokenHandler`。`errorHandler` 还会接到其它失败（500、断网、取消、登录 401），不要一律跳登录。


## License

MIT
