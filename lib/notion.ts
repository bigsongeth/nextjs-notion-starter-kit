import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { mergeRecordMaps } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function retry<T>(
  fn: () => Promise<T>,
  { retries = 3, minTimeout = 1000 }: { retries?: number; minTimeout?: number } = {}
): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (retries <= 0) {
      throw err
    }

    // check for rate limit error
    if (
      err?.status === 429 ||
      err?.message?.includes('429') ||
      err?.message?.includes('Too Many Requests')
    ) {
      console.log(
        `Rate limited, retrying in ${minTimeout}ms... (${retries} retries left)`
      )
      await delay(minTimeout)
      return retry(fn, { retries: retries - 1, minTimeout: minTimeout * 2 })
    }

    throw err
  }
}

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link?.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: false
          }),
        {
          concurrency: 1 // Reduce concurrency to avoid rate limits
        }
      )
    }

    return []
  }
)

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await retry(() => notion.getPage(pageId), {
    retries: 5,
    minTimeout: 2000 // Start with 2s delay
  })

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
      ; (recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}
