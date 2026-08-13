import type { SacoAxiosCreateOptions, SacoAxiosDualTokenOptions, SacoAxiosInstance } from './types'

/** 重试标识 */
export const RETRY_FLAG = '_sacoRetry'

/** 过期标识 */
export const EXPIRED_CODE = 401

/** 是否为双 token 配置 */
export const isDualTokenOptions = (
    options: SacoAxiosCreateOptions,
): options is SacoAxiosDualTokenOptions => {
    return 'dualMode' in options && options.dualMode === true
}

/**
 * 双 token：并发过期时共用同一次刷新 Promise，后来的请求排队等同一个结果。
 * 返回 `refresh()`，每次调用拿到当前进行中（或新开）的刷新 Promise。
 * 已在途的 401 走 refresh 后重试；尚未发出的请求在 request 拦截里 waitIfRefreshing。
 */
export const useDualToken = (options: SacoAxiosDualTokenOptions, instance: SacoAxiosInstance) => {
    const { accessToken, refreshToken, refreshTokenApi, refreshTokenHandler } = options

    let refreshPromise: Promise<unknown> | null = null

    /** 单飞刷新：已有进行中的 Promise 则直接返回，刷新结束后清空以便下次再刷 */
    const refresh = (): Promise<unknown> => {
        if (!refreshPromise) {
            refreshPromise = Promise.resolve()
                .then(() => refreshTokenHandler(instance, refreshToken, accessToken))
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

    /** 是否为刷新令牌接口本身 */
    const isRefreshRequest = (url?: string) => {
        if (!url) return false
        return url.includes(refreshTokenApi)
    }

    return {
        refresh,
        waitIfRefreshing,
        isRefreshRequest,
    }
}
