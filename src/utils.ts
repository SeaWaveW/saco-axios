import type {
    SacoAxiosCreateOptions,
    SacoAxiosDualTokenOptions,
} from './types'

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

/** 从 document.cookie 读取指定 name 的值（读不到 HttpOnly，也读不到 Cookie 的 Expires） */
const readCookie = (name: string): string => {
    if (typeof document === 'undefined') return ''
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : ''
}

/** 按 tokenStorage 读取指定字段名的值 */
export const readStoredValue = (storage: SacoAxiosDualTokenOptions['tokenStorage'], key: string): string => {
    if (!storage || typeof window === 'undefined') return ''
    if (storage === 'localStorage') {
        return window.localStorage.getItem(key) ?? ''
    }
    if (storage === 'cookie') {
        return readCookie(key)
    }
    return ''
}

/** 按 tokenStorage 写入指定字段（过期时间戳等） */
export const writeStoredValue = (
    storage: SacoAxiosDualTokenOptions['tokenStorage'],
    key: string,
    value: string,
) => {
    if (!storage || typeof window === 'undefined') return
    if (storage === 'localStorage') {
        window.localStorage.setItem(key, value)
        return
    }
    if (storage === 'cookie' && typeof document !== 'undefined') {
        document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000`
    }
}

/** 失效时间戳的存储 key：`{accessToken}_expiresTime` */
export const expiresTimeStorageKey = (accessToken: string) => `${accessToken}_expiresTime`

/** 按 tokenStorage 读取指定字段名的令牌 */
export const readStoredToken = readStoredValue

/** 公开接口：传了 noAuth: true。不传视为需要令牌 */
export const isNoAuth = (config: { noAuth?: boolean }) => config.noAuth === true
