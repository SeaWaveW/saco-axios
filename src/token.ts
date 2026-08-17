import type {
    SacoAxiosDualTokenOptions,
    SacoAxiosDualTokenTimeOptions,
    SacoAxiosInstance,
    SacoAxiosRequestConfig,
} from './types'
import { readStoredToken, readStoredValue, writeStoredValue, expiresTimeStorageKey } from './utils'

/**
 * 双 token：并发过期时共用同一次刷新 Promise，后来的请求排队等同一个结果。
 * 返回 `refresh()`，每次调用拿到当前进行中（或新开）的刷新 Promise。
 * 已在途的 401 走 refresh 后重试；尚未发出的请求在 request 拦截里 waitIfRefreshing。
 * 每次请求用当前 expiresTime（毫秒时间戳）判断是否提前刷新；默认从 localStorage 读 access 令牌挂头。
 */
export const useDualToken = (options: SacoAxiosDualTokenOptions, instance: SacoAxiosInstance) => {
    const { accessToken, refreshToken, refreshTokenApi, refreshTokenHandler } = options
    const tokenStorage = options.tokenStorage ?? 'localStorage'
    const timeOptions = options as SacoAxiosDualTokenTimeOptions
    const expireKey = timeOptions.expires ?? expiresTimeStorageKey(accessToken)

    const readExpireAt = (): number => {
        const stored = Number(readStoredValue(tokenStorage, expireKey))
        if (Number.isFinite(stored) && stored > 0) return stored
        const memory = timeOptions.expiresTime
        return typeof memory === 'number' && memory > 0 ? memory : 0
    }

    const persistExpiresTime = (validTime: number) => {
        timeOptions.expiresTime = validTime
        writeStoredValue(tokenStorage, expireKey, String(validTime))
    }

    const storedExpireAt = readExpireAt()
    if (storedExpireAt > 0) {
        timeOptions.expiresTime = storedExpireAt
    }

    let refreshPromise: Promise<unknown> | null = null

    /** 单飞刷新：已有进行中的 Promise 则直接返回，刷新结束后清空以便下次再刷 */
    const refresh = (): Promise<unknown> => {
        if (!refreshPromise) {
            refreshPromise = Promise.resolve()
                .then(() => refreshTokenHandler(instance, refreshToken, accessToken, expireKey))
                .finally(() => {
                    refreshPromise = null
                })
        }
        return refreshPromise
    }

    /**
     * 正在刷新则排队等刷新完成；否则立刻放行。
     * 刷新接口自己不能调这个，否则会死锁。
     */
    const waitIfRefreshing = (): Promise<unknown> => {
        return refreshPromise ?? Promise.resolve()
    }

    /**
     * 每次请求读取当前失效时间戳（毫秒）。
     * Date.now() + checkTokenTime >= expiresTime 则应主动刷新；未 set 或非正数则跳过。
     */
    const shouldRefreshByTime = (): boolean => {
        const expireAt = readExpireAt()
        if (expireAt <= 0) return false
        return Date.now() + (timeOptions.checkTokenTime ?? 0) >= expireAt
    }

    /**
     * 从 cookie / localStorage 读取 access 令牌并挂到请求头（头名即 accessToken 字段名）。
     * Authorization 且值未带 Bearer 时自动补上。cookie 模式会打开 withCredentials。
     */
    const applyAccessToken = (config: SacoAxiosRequestConfig) => {
        if (tokenStorage === 'cookie') {
            config.withCredentials = true
        }
        const token = readStoredToken(tokenStorage, accessToken)
        if (!token) return
        const value =
            accessToken.toLowerCase() === 'authorization' && !/^bearer\s/i.test(token)
                ? `Bearer ${token}`
                : token
        if (typeof config.headers.set === 'function') {
            config.headers.set(accessToken, value)
        } else {
            config.headers[accessToken] = value
        }
    }

    /** 是否为刷新令牌接口本身 */
    const isRefreshRequest = (url?: string) => {
        if (!url) return false
        return url.includes(refreshTokenApi)
    }

    return {
        refresh,
        waitIfRefreshing,
        shouldRefreshByTime,
        applyAccessToken,
        persistExpiresTime,
        isRefreshRequest,
        tokenStorage,
    }
}
