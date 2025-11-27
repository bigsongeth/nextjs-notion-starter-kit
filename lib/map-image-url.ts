import { type Block } from 'notion-types'
import { defaultMapImageUrl } from 'notion-utils'

import { defaultPageCover, defaultPageIcon } from './config'

export const mapImageUrl = (url: string | undefined, block: Block) => {
  if (url === defaultPageCover || url === defaultPageIcon) {
    return url
  }

  const imageUrl = defaultMapImageUrl(url, block)

  // To enable caching via Cloudflare Workers (or other CDNs):
  // 1. Deploy the worker script found in `scripts/cloudflare-worker.js`
  // 2. Uncomment the lines below and set your worker URL
  const imageProxy = 'https://notionimage.bigsong.site'
  if (imageUrl && imageProxy) {
    return `${imageProxy}/${encodeURIComponent(imageUrl)}`
  }

  return imageUrl
}
