import type {
	CreateAxiosDefaults,
	AxiosResponse,
	AxiosInstance,
	AxiosError,
	AxiosRequestConfig,
	InternalAxiosRequestConfig,
} from 'axios'

/** 创建axios实例配置。C 透传给单次请求和 error.config */
export type SacoAxiosCreateOptions<C extends object = object> =
	| SacoAxiosBaseOptions<C>
	| SacoAxiosDualTokenOptions<C>
	| SacoAxiosDualTokenTimeOptions<C>

/** axios基础配置。C：业务追加的单次请求字段，默认没有 */
export type SacoAxiosBaseOptions<C extends object = object> = CreateAxiosDefaults & {
	/** 响应code映射函数(可选) */
	codeMaps?: SacoAxiosCodeMaps
	/** 请求拦截处理函数 */
	requestHandler?: SacoAxiosRequestHandler<C>
	/** 成功统一处理函数 */
	successHandler?: SacoAxiosSuccessHandler
	/** 失败统一处理函数 */
	errorHandler?: SacoAxiosErrorHandler<C>
}

/** 令牌存储方式：库按 accessToken / refreshToken 字段名去对应存储读取 */
export type SacoAxiosTokenStorage = 'cookie' | 'localStorage'

/** 双token验证配置 */
export type SacoAxiosDualTokenOptions<C extends object = object> =
	SacoAxiosBaseOptions<C> & {
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
		instance: SacoAxiosInstance<C>,
		refreshToken: string,
		accessToken: string,
		expires: string,
	) => Promise<unknown>
}

/** 双token验证配置(时间)类型 */
export type SacoAxiosDualTokenTimeOptions<C extends object = object> =
	SacoAxiosDualTokenOptions<C> & {
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

/**
 * 扩展 axios 实例。
 * 不从 AxiosInstance 继承 get/post：那些重载还在时，对象字面量会按原来的 AxiosRequestConfig 检查，业务字段会被判成多余属性。
 * C 追加到单次配置上，业务用 createAxios<C> 传入。
 */
export type SacoAxiosInstance<C extends object = object> = Pick<
	AxiosInstance,
	'defaults' | 'interceptors'
> &
	SacoAxiosMethodMap<C> & {
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

/** 单次请求方法。配置是 axios 的加上业务字段 C，headers 仍可选 */
type SacoAxiosMethodMap<C extends object> = {
	request<T = any, R = AxiosResponse<T>, D = any>(
		config: SacoAxiosCallConfig<C> & { data?: D },
	): Promise<R>
	get<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	delete<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	head<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	options<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	post<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	put<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	patch<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	postForm<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	putForm<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	patchForm<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	query<T = any, R = AxiosResponse<T>, D = any>(
		url: string,
		data?: D,
		config?: SacoAxiosCallConfig<C>,
	): Promise<R>
	getUri(config?: SacoAxiosCallConfig<C>): string
}

/** 调用方传入的单次配置。C 是 createAxios 的泛型 */
export type SacoAxiosCallConfig<C extends object = object> = AxiosRequestConfig & C

/** 响应成功处理函数 */
export type SacoAxiosSuccessHandler = (
	response: SacoAxiosResponse,
	resolve: (...args: any[]) => void,
	reject: (...args: any[]) => void,
) => void

/** 响应失败处理函数。error.config 带上业务字段 C */
export type SacoAxiosErrorHandler<C extends object = object> = (
	error: SacoAxiosResponseError<C>,
) => any

/** 响应code映射函数处理类型 */
export type SacoAxiosCodeMaps = {
	[key: number]: SacoAxiosSuccessHandler
}

/** 请求拦截配置类型。C 是业务追加字段 */
export type SacoAxiosRequestConfig<C extends object = object> =
	InternalAxiosRequestConfig &
		C & {
			_sacoRetry?: boolean
			/**
			 * 公开接口：不挂令牌、不按时间刷新、401 也不走双 token 刷新，请求原样发出。
			 * 不传视为 false（需要令牌）。登录 / 注册 / 验证码等由业务自行标 true。
			 * 不叫 auth：axios 已用 auth 表示 HTTP Basic（username / password）。
			 */
			noAuth?: boolean
			/**
			 * 库写入：localStorage 下 access / refresh 都为空时的 401，未走刷新。
			 * 供 errorHandler 区分「未登录」和「刷新失败」。Cookie / HttpOnly 读不到则不会标。
			 */
			isEmpty?: boolean
		}

declare module 'axios' {
	interface AxiosRequestConfig {
		/**
		 * 公开接口。不传视为 false（需要令牌）。true：不挂令牌、不刷新。
		 */
		noAuth?: boolean
		/**
		 * 库写入：存储中无令牌时的 401，未走刷新。
		 */
		isEmpty?: boolean
		_sacoRetry?: boolean
	}
}

/** 请求拦截处理函数 */
export type SacoAxiosRequestHandler<C extends object = object> = (
	config: SacoAxiosRequestConfig<C>,
) => SacoAxiosRequestConfig<C>

/** 拦截错误类型 */
export type SacoAxiosRequestError<C extends object = object> = AxiosError & {
	config: SacoAxiosRequestConfig<C>
}

/** 响应错误类型 */
export type SacoAxiosResponseError<C extends object = object> = AxiosError & {
	config: SacoAxiosRequestConfig<C>
}
