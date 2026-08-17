import type {
    CreateAxiosDefaults,
    AxiosResponse,
    AxiosInstance,
    AxiosError,
    InternalAxiosRequestConfig
} from 'axios'

/** 创建axios实例配置 */
export type SacoAxiosCreateOptions = SacoAxiosBaseOptions | SacoAxiosDualTokenOptions | SacoAxiosDualTokenTimeOptions

/** axios基础配置 */
export type SacoAxiosBaseOptions = CreateAxiosDefaults & {
    /** 响应code映射函数(可选) */
    codeMaps?: SacoAxiosCodeMaps
    /** 请求拦截处理函数 */
    requestHandler?: SacoAxiosRequestHandler
    /** 成功统一处理函数 */
    successHandler?: SacoAxiosSuccessHandler
    /** 失败统一处理函数 */
    errorHandler?: SacoAxiosErrorHandler
}

/** 令牌存储方式：库按 accessToken / refreshToken 字段名去对应存储读取 */
export type SacoAxiosTokenStorage = 'cookie' | 'localStorage'

/** 双token验证配置 */
export type SacoAxiosDualTokenOptions = SacoAxiosBaseOptions & {
    /** 是否启用双token验证 */
    dualMode: boolean
    /** 访问令牌（短期）字段名：存储 key，同时作为请求头名 */
    accessToken: string
    /** 刷新令牌（长期）字段名：存储 key */
    refreshToken: string
    /**
     * 令牌存储方式，默认 localStorage。
     * 库每次请求按 accessToken 字段名读取并挂到请求头。
     * cookie：读 document.cookie（HttpOnly 读不到，此时只靠浏览器自动带 Cookie，会打开 withCredentials）；
     * 部分安卓 WebView 拿不到 Cookie，故默认 localStorage。
     */
    tokenStorage?: SacoAxiosTokenStorage
    /** 刷新令牌接口地址 */
    refreshTokenApi: string
    /** 刷新令牌接口处理函数：用 instance 发刷新请求；后三个参数是存储字段名（expires 默认 `{accessToken}_expiresTime`）。token 在 data 里则按字段名写入存储；后端 Set-Cookie 可直接 return instance.post(...) */
    refreshTokenHandler: (
        instance: SacoAxiosInstance,
        refreshToken: string,
        accessToken: string,
        expires: string
    ) => Promise<unknown>
}

/** 双token验证配置(时间)类型 */
export type SacoAxiosDualTokenTimeOptions = SacoAxiosDualTokenOptions & {
    /**
     * 失效时间戳的存储字段名。默认 `{accessToken}_expiresTime`。
     * 与 accessToken / refreshToken 一样是 key，不是时间值。
     */
    expires?: string
    /**
     * 令牌失效时间戳，单位毫秒，与 Date.now() 同一量级（如 1710000000000）。
     * 必须是后端返回的绝对时间戳，不要传剩余时长，也不要 Date.now() + ttl。
     * 创建时可先不传，登录/刷新后用 instance.setExpiresTime 写入（会缓存到 tokenStorage 的 expires 字段，刷新页面后读回）。
     */
    expiresTime?: number
    /**
     * 提前检查阈值，单位毫秒。每次请求判断：Date.now() + checkTokenTime >= expiresTime 则主动刷新。
     * 例如 60 * 1000 表示提前 1 分钟。不传视为 0。
     */
    checkTokenTime?: number
}

/** 拓展response类型 */
export type SacoAxiosResponse = AxiosResponse & {}

/** 扩展axios实例 */
export type SacoAxiosInstance = AxiosInstance & {
    /** 文件下载 */
    downloadFile: () => void
    /**
     * 写入令牌失效时间（单位均为毫秒）。
     * 会按 tokenStorage 缓存（默认 localStorage，key 为 expires，缺省 `{accessToken}_expiresTime`），刷新页面后自动读回。
     * @param validTime 后端返回的失效时间戳，如 1710000000000；不是剩余时长，不要与 Date.now() 相加
     * @param leadTime 提前检查阈值；不传则沿用创建时的 checkTokenTime
     */
    setExpiresTime: (validTime: number, leadTime?: number) => void
}

/** 响应成功处理函数 */
export type SacoAxiosSuccessHandler = (
    response: SacoAxiosResponse,
    resolve: (...args: any[]) => void,
    reject: (...args: any[]) => void
) => void

/** 响应失败处理函数 */
export type SacoAxiosErrorHandler = (error: AxiosError) => any

/** 响应code映射函数处理类型 */
export type SacoAxiosCodeMaps = {
    [key: number]: SacoAxiosSuccessHandler
}

/** 请求拦截配置类型 */
export type SacoAxiosRequestConfig = InternalAxiosRequestConfig & {
    _sacoRetry?: boolean
    /**
     * 是否需要令牌。不传视为 true。
     * false：不挂令牌、不按时间刷新、401 也不走双 token 刷新，请求原样发出。
     * 登录 / 注册 / 验证码等接口应传 false。
     * 不叫 auth：axios 已用 auth 表示 HTTP Basic（username / password）。
     */
    requireAuth?: boolean
}

declare module 'axios' {
    interface AxiosRequestConfig {
        /**
         * 是否需要令牌。不传视为 true。
         * false：不挂令牌、不按时间刷新、401 也不走双 token 刷新，请求原样发出。
         */
        requireAuth?: boolean
        _sacoRetry?: boolean
    }
}

/** 请求拦截处理函数 */
export type SacoAxiosRequestHandler = (config: SacoAxiosRequestConfig) => SacoAxiosRequestConfig

/** 拦截错误类型 */
export type SacoAxiosRequestError = AxiosError & {
    config: SacoAxiosRequestConfig
}

/** 响应错误类型 */
export type SacoAxiosResponseError = AxiosError & {
    config: SacoAxiosRequestConfig
}
