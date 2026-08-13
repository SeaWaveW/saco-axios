import axios, { isCancel } from 'axios'
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
    useDualToken,
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
        return config
    }, (error: SacoAxiosRequestError) => {
        // 请求拦截错误处理
        error = options?.errorHandler?.(error) ?? error
        return Promise.reject(error)
    })
    /**
     * 响应拦截拆两条：
     * 1. 内部先接 401 / 刷新（resolve 重试结果，后面业务当成功；reject 才交给下一条）
     * 2. 业务 codeMaps / successHandler / errorHandler
     */
    if (dualToken) {
        // 后注册请求拦截（先执行）
        instance.interceptors.request.use(async (config: SacoAxiosRequestConfig) => {
            // 内部优化拦截：正在刷新令牌时排队，拿到新 token 再发出（刷新接口本身不能等，否则死锁）
            if (!dualToken.isRefreshRequest(config.url)) {
                const access = await dualToken.waitIfRefreshing()
                if (access) {
                    dualToken.setAccessToken(config, access)
                }
            }
            return config
        })
        // 先注册响应拦截（先执行）
        instance.interceptors.response.use(
            (response) => response,
            async (error: SacoAxiosResponseError) => {
                // 取消请求直接抛给业务拦截
                if (isCancel(error)) {
                    return Promise.reject(error)
                }
                // 获取响应状态码
                const status = error.response?.status
                // 获取请求配置
                const config = error.config
                // 如果响应状态码不是 401 或请求配置不存在，则直接返回错误
                if (status !== EXPIRED_CODE || !config) {
                    return Promise.reject(error)
                }
                // 刷新接口本身失败，或已经重试过仍 401，不再递归刷新
                if (dualToken.isRefreshRequest(config.url) || config[RETRY_FLAG]) {
                    return Promise.reject(error)
                }
                try {
                    // 等待刷新令牌
                    const access = await dualToken.refresh()
                    // 设置重试标识
                    config[RETRY_FLAG] = true
                    // 设置访问令牌
                    dualToken.setAccessToken(config, access)
                    // 重新请求
                    return instance.request(config)
                } catch (refreshError) {
                    // 如果刷新令牌失败，则直接返回错误
                    return Promise.reject(refreshError)
                }
            },
        )
    }
    /** 响应拦截 */
    instance.interceptors.response.use((response) => {
        return new Promise((resolve, reject) => {
            // 获取响应码
            const code = response.data?.code
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
    }, (error: SacoAxiosResponseError) => {
        // 响应拦截错误处理
        error = options?.errorHandler?.(error) ?? error
        return Promise.reject(error)
    })
    return instance
}

export default createAxios
