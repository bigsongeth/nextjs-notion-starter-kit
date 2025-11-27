// Cloudflare Worker script for proxying Notion images
// Deploy this to Cloudflare Workers: https://workers.cloudflare.com/

addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)
    let imageUrl

    // 1. 尝试从 Path 获取并解码 (更稳健的写法)
    try {
        // slice(1) 去掉开头的 '/'
        const rawPath = url.pathname.slice(1)
        if (rawPath) {
            imageUrl = decodeURIComponent(rawPath)
        }
    } catch (err) {
        return new Response('Invalid URL encoding in path', { status: 400 })
    }

    // 2. 如果 Path 里没找到，尝试从 Query 参数获取 (作为备选，兼容性更好)
    if (!imageUrl) {
        imageUrl = url.searchParams.get('url')
    }

    if (!imageUrl) {
        return new Response('Missing image URL. Usage: /<encoded_url> or ?url=<encoded_url>', { status: 400 })
    }

    // 3. 设置超时控制 (20秒)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    try {
        const imageResponse = await fetch(imageUrl, {
            headers: {
                // Forward necessary headers
                'User-Agent': 'NotionImageProxy/1.0',
            },
            signal: controller.signal, // 绑定中断信号
        })

        // 请求成功，清除定时器
        clearTimeout(timeoutId)

        // Reconstruct the response to ensure it's cacheable and has the right headers
        const headers = new Headers(imageResponse.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Cache-Control', 'public, max-age=31536000, immutable') // Cache for 1 year

        // 删除可能导致问题的 header
        headers.delete('content-security-policy')
        headers.delete('content-encoding') // 让 Worker 自动处理压缩

        return new Response(imageResponse.body, {
            status: imageResponse.status,
            statusText: imageResponse.statusText,
            headers,
        })
    } catch (err) {
        clearTimeout(timeoutId) // 确保清除定时器

        if (err.name === 'AbortError') {
            return new Response('Request timed out (20s)', { status: 504 })
        }
        return new Response(`Error fetching image: ${err.message}`, { status: 500 })
    }
}