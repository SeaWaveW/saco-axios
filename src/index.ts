import axios from 'axios'

/** 本包自己的具名导出：axios CJS 声明是 export =，没有 isCancel 具名成员 */
export const isCancel = (value: unknown): boolean => axios.isCancel(value)
export const isAxiosError = (payload: unknown): boolean => axios.isAxiosError(payload)
export const CanceledError = axios.CanceledError
export const AxiosError = axios.AxiosError
export const AxiosHeaders = axios.AxiosHeaders
export const HttpStatusCode = axios.HttpStatusCode
export const all = axios.all.bind(axios)
export const spread = axios.spread.bind(axios)
export const toFormData = axios.toFormData.bind(axios)
export const formToJSON = axios.formToJSON.bind(axios)
export const mergeConfig = axios.mergeConfig.bind(axios)
import type {
	SacoAxiosCreateOptions,
	SacoAxiosDualTokenTimeOptions,
	SacoAxiosInstance,
	SacoAxiosRequestConfig,
	SacoAxiosResponseError,
} from './types'
import { RETRY_FLAG, EXPIRED_CODE, isDualTokenOptions, isNoAuth } from './utils'
import { useDualToken } from './token'

export type { SacoAxiosCreateOptions, SacoAxiosInstance } from './types'

/** 创建axios实例。C 是业务追加的单次请求字段，会进到 get/post 的 config 和 error.config */
export const createAxios = <C extends object = object>(
	options: SacoAxiosCreateOptions<C>,
): SacoAxiosInstance<C> => {
	/** 创建实例。setExpiresTime 在下面挂上，这里先按业务实例的形状用 */
	const instance = axios.create(options) as unknown as SacoAxiosInstance<C>
	const timeOptions = options as SacoAxiosDualTokenTimeOptions<C>
	/** 双 token：并发 401 共用一次 refresh Promise */
	const dualToken = isDualTokenOptions(options)
		? useDualToken(options, instance)
		: null
	/**
	 * 写入令牌失效时间（毫秒），并按 tokenStorage 缓存，刷新页面后仍能读回。
	 * validTime：后端返回的失效时间戳；leadTime：提前检查阈值，不传则沿用创建时配置。
	 */
	instance.setExpiresTime = (validTime: number, leadTime?: number) => {
		timeOptions.expiresTime = validTime
		if (typeof leadTime === 'number') {
			timeOptions.checkTokenTime = leadTime
		}
		dualToken?.persistExpiresTime(validTime)
	}
	if (dualToken?.tokenStorage === 'cookie') {
		instance.defaults.withCredentials = true
	}
	/** 请求拦截 */
	instance.interceptors.request.use(
		(config) => {
			// 请求拦截处理。C 只在类型上，运行时就是这份 config
			const handled =
				options.requestHandler?.(config as SacoAxiosRequestConfig<C>) ??
				config
			return handled
		},
		(error) => {
			// 请求拦截错误处理
			error =
				options?.errorHandler?.(error as SacoAxiosResponseError<C>) ??
				error
			return Promise.reject(error)
		},
	)
	/**
	 * 响应拦截拆两条：
	 * 1. 内部先接 401 / 刷新（resolve 重试结果，后面业务当成功；reject 才交给下一条）
	 * 2. 业务 codeMaps / successHandler / errorHandler
	 */
	if (dualToken) {
		// 后注册请求拦截（先执行）
		instance.interceptors.request.use(
			async (config) => {
				// 内部优化拦截：正在刷新令牌时排队，拿到新 token 再发出（刷新接口本身不能等，否则死锁）
				if (
					!dualToken.isRefreshRequest(config.url) &&
					!isNoAuth(config)
				) {
					// 每次请求用当前毫秒时间戳判断是否提前刷新
					if (
						dualToken.shouldRefreshByTime() &&
						!dualToken.isTokenEmpty()
					) {
						await dualToken.refresh()
					}
					await dualToken.waitIfRefreshing()
					// 刷新 401 后业务 errorHandler 已清 token；再 return config 会把原请求再打出去
					if (dualToken.isTokenEmpty()) {
						config.isEmpty = true
						return Promise.reject(
							new AxiosError(
								'Unauthorized',
								AxiosError.ERR_BAD_REQUEST,
								config,
							),
						)
					}
					// 刷新完成后从 cookie / localStorage 读取最新 access 令牌
					dualToken.applyAccessToken(config)
				}
				return config
			},
		)
		// 先注册响应拦截（先执行）
		instance.interceptors.response.use(
			(response) => response,
			async (error) => {
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
				// 刷新接口本身失败、已重试过、公开接口，不再走刷新
				if (
					dualToken.isRefreshRequest(config.url) ||
					config[RETRY_FLAG] ||
					isNoAuth(config)
				) {
					return Promise.reject(error)
				}
				// 存储里没有令牌：未登录，不刷新，带上 isEmpty 给 errorHandler
				if (dualToken.isTokenEmpty()) {
					config.isEmpty = true
					return Promise.reject(error)
				}
				try {
					// 等待刷新令牌
					await dualToken.refresh()
					// 设置重试标识
					config[RETRY_FLAG] = true
					// 重新请求（新 token 由请求拦截从存储读取并挂上）
					return instance.request(config)
				} catch (refreshError) {
					// 如果刷新令牌失败，则直接返回错误
					return Promise.reject(refreshError)
				}
			},
		)
	}
	/** 响应拦截 */
	instance.interceptors.response.use(
		(response) => {
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
		},
		(error) => {
			// 响应拦截错误处理
			error =
				options?.errorHandler?.(error as SacoAxiosResponseError<C>) ??
				error
			return Promise.reject(error)
		},
	)
	return instance
}

export default createAxios
