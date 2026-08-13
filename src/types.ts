import type {
    CreateAxiosDefaults,
    AxiosResponse,
    AxiosInstance,
    AxiosError,
    InternalAxiosRequestConfig
} from 'axios'

/** 创建axios实例配置 */
export type SacoAxiosCreateOptions = SacoAxiosBaseOptions | SacoAxiosDualTokenOptions

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

/** 双token验证配置 */
export type SacoAxiosDualTokenOptions = SacoAxiosBaseOptions & {
    /** 是否启用双token验证 */
    dualMode: boolean
    /** 访问令牌（短期）字段 */
    accessToken: string
    /** 刷新令牌（长期）字段 */
    refreshToken: string
    /** 刷新令牌接口地址 */
    refreshTokenApi: string
    /** 刷新令牌接口处理函数：用 instance 发刷新请求；token 在 data 里则业务按字段名写入存储，后端 Set-Cookie 则可直接 return instance.post(...) */
    refreshTokenHandler: (
        instance: SacoAxiosInstance,
        refreshToken: string,
        accessToken: string
    ) => Promise<unknown>
}

/** 拓展response类型 */
export type SacoAxiosResponse = AxiosResponse & {}

/** 扩展axios实例 */
export type SacoAxiosInstance = AxiosInstance & {
    /** 文件下载 */
    downloadFile: () => void
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
