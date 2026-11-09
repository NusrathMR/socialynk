import axios from "axios"

const api = axios.create({
  baseURL: "https://socialynk-uki-final-project.onrender.com/api",
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

export function generateCaption(prompt, signal) {
  const token = localStorage.getItem("token")
  const headers = { "Content-Type": "application/json" }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(`${api.defaults.baseURL}/ai/generate-caption`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
    signal,
  })
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
