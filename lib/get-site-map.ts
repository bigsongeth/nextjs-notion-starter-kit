import { getAllPagesInSpace, getPageProperty, uuidToId } from 'notion-utils'
import pMemoize from 'p-memoize'

import type * as types from './types'
import * as config from './config'
import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import { notion } from './notion-api'

const uuid = !!includeNotionIdInUrls

export async function getSiteMap(): Promise<types.SiteMap> {
  const partialSiteMap = await getAllPages(
    config.rootNotionPageId,
    config.rootNotionSpaceId ?? undefined
  )

  return {
    site: config.site,
    ...partialSiteMap
  } as types.SiteMap
}

const getAllPages = pMemoize(getAllPagesImpl, {
  cacheKey: (...args) => JSON.stringify(args)
})

const retry = async <T>(
  fn: () => Promise<T>,
  { retries = 5, minTimeout = 5000 }: { retries?: number; minTimeout?: number } = {}
): Promise<T> => {
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  try {
    return await fn()
  } catch (err: any) {
    if (retries <= 0) {
      throw err
    }

    if (
      err?.status === 429 ||
      err?.message?.includes('429') ||
      err?.message?.includes('Too Many Requests')
    ) {
      const jitter = Math.random() * 1000
      const timeout = minTimeout + jitter
      console.log(
        `Rate limited, retrying in ${timeout.toFixed(0)}ms... (${retries} retries left)`
      )
      await delay(timeout)
      return retry(fn, { retries: retries - 1, minTimeout: minTimeout * 2 })
    }

    throw err
  }
}

const getPage = async (pageId: string, opts?: any) => {
  console.log('\nnotion getPage', uuidToId(pageId))
  return retry(() => notion.getPage(pageId, {
    kyOptions: {
      timeout: 30_000
    },
    ...opts
  }))
}

async function getAllPagesImpl(
  rootNotionPageId: string,
  rootNotionSpaceId?: string,
  {
    maxDepth = 1
  }: {
    maxDepth?: number
  } = {}
): Promise<Partial<types.SiteMap>> {
  const pageMap = await getAllPagesInSpace(
    rootNotionPageId,
    rootNotionSpaceId,
    getPage,
    {
      maxDepth
    }
  )

  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map: Record<string, string>, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) {
        console.warn(`Error loading page "${pageId}"`)
        return map
      }

      const block = recordMap.block[pageId]?.value
      if (
        !(getPageProperty<boolean | null>('Public', block!, recordMap) ?? true)
      ) {
        return map
      }

      const canonicalPageId = getCanonicalPageId(pageId, recordMap, {
        uuid
      })!

      if (map[canonicalPageId]) {
        // you can have multiple pages in different collections that have the same id
        // TODO: we may want to error if neither entry is a collection page
        console.warn('error duplicate canonical page id', {
          canonicalPageId,
          pageId,
          existingPageId: map[canonicalPageId]
        })

        return map
      } else {
        return {
          ...map,
          [canonicalPageId]: pageId
        }
      }
    },
    {}
  )

  return {
    pageMap,
    canonicalPageMap
  }
}
