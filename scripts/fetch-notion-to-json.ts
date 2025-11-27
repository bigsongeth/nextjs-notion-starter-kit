import { NotionAPI } from 'notion-client'
import { getBlockTitle, getPageProperty } from 'notion-utils'
import * as fs from 'fs'
import * as path from 'path'

// Notion 页面 ID
// URL: https://www.notion.so/dnlive/DN-26352a082dc081cab177f3d3f1e58f7a
const pageId = '26352a082dc081508069e124015b86b9'

// 初始化 Notion API 客户端
const notion = new NotionAPI()

/**
 * 提取集合中所有页面的详细信息
 */
function extractCollectionPages(recordMap: any, collectionId: string) {
    const collection = recordMap.collection?.[collectionId]?.value
    if (!collection) return null

    // 获取集合名称
    const collectionName = collection.name?.map((t: any) => t[0]).join('') || 'Untitled'

    // 获取集合的 schema（字段定义）
    const schema = collection.schema || {}

    // 查找所有属于这个集合的页面
    const pages = Object.values(recordMap.block)
        .filter((blockRecord: any) => {
            const block = blockRecord.value
            return block?.type === 'page' &&
                block.parent_table === 'collection' &&
                block.parent_id === collectionId
        })
        .map((blockRecord: any) => {
            const block = blockRecord.value
            const pageData: any = {
                id: block.id,
                title: getBlockTitle(block, recordMap),
                properties: {},
                rawProperties: block.properties || {},
                format: block.format || {},
                createdTime: block.created_time,
                lastEditedTime: block.last_edited_time,
            }

            // 提取所有属性值
            Object.entries(schema).forEach(([propId, prop]: [string, any]) => {
                try {
                    const value = getPageProperty(prop.name, block, recordMap)
                    if (value !== null && value !== undefined && value !== '') {
                        pageData.properties[prop.name] = {
                            type: prop.type,
                            value: value
                        }
                    }
                } catch (e) {
                    // 如果无法获取属性值，记录原始数据
                    if (block.properties?.[propId]) {
                        pageData.properties[prop.name] = {
                            type: prop.type,
                            value: null,
                            raw: block.properties[propId]
                        }
                    }
                }
            })

            return pageData
        })

    return {
        id: collectionId,
        name: collectionName,
        schema: schema,
        pageCount: pages.length,
        pages: pages
    }
}

/**
 * 提取所有块的信息
 */
function extractBlocks(recordMap: any) {
    const blocks: any[] = []

    Object.entries(recordMap.block).forEach(([blockId, blockRecord]: [string, any]) => {
        const block = blockRecord.value
        if (!block) return

        const blockData: any = {
            id: blockId,
            type: block.type,
            properties: block.properties || {},
            format: block.format || {},
            parentId: block.parent_id,
            parentTable: block.parent_table,
            alive: block.alive,
            createdTime: block.created_time,
            lastEditedTime: block.last_edited_time,
        }

        // 如果有标题，添加标题
        if (block.properties?.title) {
            blockData.title = getBlockTitle(block, recordMap)
        }

        // 如果有内容，添加内容
        if (block.content) {
            blockData.contentIds = block.content
        }

        blocks.push(blockData)
    })

    return blocks
}

/**
 * 主函数：获取 Notion 页面数据并保存到 JSON
 */
async function main() {
    try {
        console.log(`正在获取 Notion 页面: ${pageId}...`)
        const recordMap = await notion.getPage(pageId)

        console.log('✓ 成功获取页面数据')

        // 构建完整的数据结构
        const fullData: any = {
            pageId: pageId,
            fetchedAt: new Date().toISOString(),
            summary: {
                totalBlocks: Object.keys(recordMap.block).length,
                totalCollections: Object.keys(recordMap.collection || {}).length,
                totalCollectionViews: Object.keys(recordMap.collection_view || {}).length,
            },
            collections: [],
            blocks: extractBlocks(recordMap),
            rawRecordMap: recordMap // 保留原始数据以备需要
        }

        // 提取所有集合的详细信息
        const collectionIds = Object.keys(recordMap.collection || {})
        console.log(`\n找到 ${collectionIds.length} 个集合`)

        collectionIds.forEach(collId => {
            const collectionData = extractCollectionPages(recordMap, collId)
            if (collectionData) {
                console.log(`  - ${collectionData.name}: ${collectionData.pageCount} 个页面`)
                fullData.collections.push(collectionData)
            }
        })

        // 保存到 JSON 文件
        const outputDir = path.join(process.cwd(), 'data')
        const outputFile = path.join(outputDir, `notion-page-${pageId}.json`)

        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        // 写入文件
        fs.writeFileSync(outputFile, JSON.stringify(fullData, null, 2), 'utf-8')

        console.log(`\n✓ 数据已保存到: ${outputFile}`)
        console.log(`\n数据摘要:`)
        console.log(`  - 总块数: ${fullData.summary.totalBlocks}`)
        console.log(`  - 集合数: ${fullData.summary.totalCollections}`)
        console.log(`  - 集合视图数: ${fullData.summary.totalCollectionViews}`)

        // 输出每个集合的统计
        fullData.collections.forEach((coll: any) => {
            console.log(`  - 集合 "${coll.name}": ${coll.pageCount} 个页面`)
        })

    } catch (error) {
        console.error('错误:', error)
        process.exit(1)
    }
}

// 运行主函数
main()
