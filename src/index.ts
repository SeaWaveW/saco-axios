import axios, { isCancel } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import type {
    SacoAxiosCreateOptions,
    SacoAxiosInstance,
    SacoAxiosRequestConfig,
    SacoAxiosRequestError,
    SacoAxiosResponseError,
} from './types'
import { 
    RETRY_FLAG, 
    EXPIRED_CODE,
    isDualTokenOptions, 
    useDualToken 
} from './utils'

/** 创建axios实例 */
export const createAxios = (options: SacoAxiosCreateOptions) => {
    /** 创建实例 */
    const instance = axios.create(options) as SacoAxiosInstance
    /** 双 token：并发 401 共用一次 refresh Promise */
    const dualToken = isDualTokenOptions(options)
        ? useDualToken(options, instance)
        : null
    /** 请求拦截 */
    instance.interceptors.request.use((config: SacoAxiosRequestConfig) => {
        // 请求拦截处理
        config = options.requestHandler?.(config) ?? config
        // 内部优化拦截


        
        return config
    }, (error: SacoAxiosRequestError) => {
        // 请求拦截错误处理
        error = options?.errorHandler?.(error) ?? error
        return Promise.reject(error)
    })
    /** 响应拦截 */
    instance.interceptors.response.use(response => {
        return new Promise(async (resolve, reject) => {
            // 获取响应码
            const code = response.data.code
            // 是否存在响应码处理函数
            const codeHandler = options.codeMaps?.[code]
            if (codeHandler) {
                codeHandler(response, resolve, reject)
            } 
            // 是否存在成功统一处理函数
            else if (options.successHandler) {
                options.successHandler(response, resolve, reject)
            } 
            // 否则直接回调成功
            else {
                resolve(response)
            }
        })
    }, async (error: SacoAxiosResponseError) => {
        // 如果请求被取消或不存在双 token，则直接返回错误
        if (isCancel(error) || !dualToken) {
            error = options?.errorHandler?.(error) ?? error
            return Promise.reject(error)
        }
        // 获取响应状态码
        const status = error.response?.status
        // 获取请求配置
        const config = error.config
        // 如果响应状态码不是 401 或请求配置不存在，则直接返回错误
        if (status !== EXPIRED_CODE || !config) {
            error = options?.errorHandler?.(error) ?? error
            return Promise.reject(error)
        }
        // 刷新接口本身失败，不再递归刷新
        if (dualToken.isRefreshRequest(config.url)) {
            error = options?.errorHandler?.(error) ?? error
            return Promise.reject(error)
        }
        // 已经重试过仍 401
        if (config[RETRY_FLAG]) {
            error = options?.errorHandler?.(error) ?? error
            return Promise.reject(error)
        }

        try {
            // 等待刷新令牌
            const access = await dualToken.refresh()
            // 设置重试标识
            config[RETRY_FLAG] = true
            // 设置访问令牌
            if (typeof config.headers?.set === 'function') {
                config.headers.set(dualToken.accessToken, access)
            } else {
                ;(config.headers as Record<string, string>)[dualToken.accessToken] = access
            }
            // 重新请求
            return instance.request(config)
        } catch (refreshError) {
            // 如果刷新令牌失败，则直接返回错误
            error = options?.errorHandler?.(error) ?? error
            return Promise.reject(refreshError)
        }
    })
    return instance
}

export default createAxios
