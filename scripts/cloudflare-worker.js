
// Cloudflare Worker script for proxying Notion images
// Deploy this to Cloudflare Workers: https://workers.cloudflare.com/

addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)
    // The image URL is passed as the path, e.g. https://worker.dev/https%3A%2F%2Fnotion.so%2Fimage...
    // We need to decode it.
    // Note: The path might have a leading slash, so we strip it.
    const imageUrl = decodeURIComponent(url.pathname.slice(1))

    if (!imageUrl) {
        return new Response('Missing image URL', { status: 400 })
    }

    try {
        const imageResponse = await fetch(imageUrl, {
            headers: {
                // Forward necessary headers
                'User-Agent': 'NotionImageProxy/1.0',
            },
        })

        // Reconstruct the response to ensure it's cacheable and has the right headers
        const headers = new Headers(imageResponse.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Cache-Control', 'public, max-age=31536000, immutable') // Cache for 1 year

        return new Response(imageResponse.body, {
            status: imageResponse.status,
            statusText: imageResponse.statusText,
            headers,
        })
    } catch (err) {
        return new Response(`Error fetching image: ${err.message}`, { status: 500 })
    }
}
