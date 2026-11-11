import axios from "axios"

const BASE_URL = `${import.meta.env.VITE_API_URL}/api`

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

let accessToken = null
let refreshRequest = null

export function setAccessToken(token) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

function requestRefresh() {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${BASE_URL}/user/refresh`, {}, { withCredentials: true })
      .then((response) => {
        setAccessToken(response.data.token)
        return response.data
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

export async function restoreSession() {
  const session = await requestRefresh()
  return session.user
}

export async function updateMyTheme(theme) {
  const response = await api.patch(
    "/user/me/theme",
    { theme },
    { validateStatus: () => true }
  )

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(response.data?.message || "Could not save your theme preference.")
    error.fieldErrors = response.data?.errors || {}
    throw error
  }

  return response.data.user
}

export async function updateMyProfile(profile) {
  const response = await api.patch("/user/me", profile, {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(response.data?.message || "Could not update profile.")
    error.fieldErrors = response.data?.errors || {}
    throw error
  }

  return response.data.user
}

export async function uploadMyAvatar(file) {
  const formData = new FormData()
  formData.append("image", file)

  const response = await api.post("/user/me/avatar", formData, {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(response.data?.message || "Could not upload profile picture.")
    error.updatedUser = response.data?.user
    throw error
  }

  return response.data.user
}

export async function deleteMyAvatar() {
  const response = await api.delete("/user/me/avatar", {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not remove profile picture.")
  }

  return response.data.user
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

function canRefreshRequest(config, status) {
  const requestUrl = config?.url || ""
  const isPublicAuthRequest =
    /\/user\/(signin|signup|refresh|logout)(?:$|\?)/.test(requestUrl)

  return (
    status === 401 &&
    config &&
    !config._retry &&
    !config.skipAuthRefresh &&
    !isPublicAuthRequest
  )
}

async function retryWithRefreshedToken(config) {
  config._retry = true

  try {
    const session = await requestRefresh()
    config.headers.Authorization = `Bearer ${session.token}`
    return await api(config)
  } catch (refreshError) {
    if ([401, 403].includes(refreshError.response?.status)) {
      clearAccessToken()
      window.dispatchEvent(new Event("auth:session-expired"))
    }
    throw refreshError
  }
}

api.interceptors.response.use(
  (response) => {
    if (!canRefreshRequest(response.config, response.status)) {
      return response
    }
    return retryWithRefreshedToken(response.config).catch(() => response)
  },
  (error) => {
    if (!canRefreshRequest(error.config, error.response?.status)) {
      return Promise.reject(error)
    }
    return retryWithRefreshedToken(error.config).catch(() => Promise.reject(error))
  }
)

export default api

export function generateCaption(prompt, signal) {
  return api
    .post(
      "/ai/generate-caption",
      { prompt },
      { signal, validateStatus: () => true }
    )
    .then((response) => ({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.data,
    }))
}

export async function uploadImage(file) {
  const formData = new FormData()
  formData.append("image", file)

  const response = await api.post("/media/upload", formData, {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data.message)
  }

  return response.data.media
}

export async function deleteImage(publicId) {
  const response = await api.delete("/media", {
    data: { publicId },
    headers: { "Content-Type": "application/json" },
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data.message)
  }

  return response.data
}

export async function getAdminSettings() {
  const response = await api.get("/admin/settings", {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not load settings")
  }

  return response.data.settings
}

export async function saveAdminSettings(settings) {
  const response = await api.put("/admin/settings", settings, {
    headers: { "Content-Type": "application/json" },
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(response.data?.message || "Could not save settings")
    error.fieldErrors = response.data?.errors || {}
    throw error
  }

  return response.data.settings
}

export async function getPublishedPosts() {
  const limit = 50
  const firstResponse = await api.get(
    `/posts?status=published&sort=-publishedAt&limit=${limit}&page=1`,
    { validateStatus: () => true }
  )

  if (firstResponse.status < 200 || firstResponse.status >= 300) {
    throw new Error(firstResponse.data?.message || "Could not load posts")
  }

  const posts = firstResponse.data.posts
  const totalPages = Math.ceil(firstResponse.data.total / limit)

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await api.get(
      `/posts?status=published&sort=-publishedAt&limit=${limit}&page=${page}`,
      { validateStatus: () => true }
    )

    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.data?.message || "Could not load posts")
    }

    posts.push(...response.data.posts)
  }

  return posts
}

export async function getRecentPosts() {
  const response = await api.get(
    "/posts?status=draft,scheduled,published,failed&sort=-updatedAt&limit=10",
    { validateStatus: () => true }
  )

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not load recent posts")
  }

  return response.data.posts
}

export async function getBrandMemory() {
  const response = await api.get("/brand-memory", {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not load Brand Memory.")
  }

  return response.data
}

async function saveBrandMemory(method, path, memory) {
  const response = await api[method](path, memory, {
    headers: { "Content-Type": "application/json" },
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(response.data?.message || "Could not save Brand Memory.")
    error.fieldErrors = response.data?.errors || {}
    throw error
  }

  return response.data.memory
}

export function createBrandMemory(memory) {
  return saveBrandMemory("post", "/brand-memory", memory)
}

export function updateBrandMemory(id, memory) {
  return saveBrandMemory("put", `/brand-memory/${encodeURIComponent(id)}`, memory)
}

export async function deleteBrandMemory(id) {
  const response = await api.delete(`/brand-memory/${encodeURIComponent(id)}`, {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not delete Brand Memory.")
  }

  return response.data
}

export async function activateBrandMemory(id) {
  const response = await api.patch(
    `/brand-memory/${encodeURIComponent(id)}/activate`,
    {},
    { validateStatus: () => true }
  )

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not activate Brand Memory.")
  }

  return response.data.activeMemory
}

export async function deactivateBrandMemory() {
  const response = await api.patch("/brand-memory/deactivate", {}, {
    validateStatus: () => true,
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || "Could not turn off Brand Memory.")
  }

  return response.data.activeMemory
}
