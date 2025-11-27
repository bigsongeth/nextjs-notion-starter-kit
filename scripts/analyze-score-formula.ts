import * as fs from 'fs'
import * as path from 'path'

// 定义数据类型
interface NotionData {
    collections: any[]
    [key: string]: any
}

/**
 * 分析综合评分公式
 */
function analyzeScoreFormula() {
    const jsonFile = path.join(process.cwd(), 'data/notion-page-26352a082dc081cab177f3d3f1e58f7a.json')
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8')) as NotionData

    console.log('='.repeat(80))
    console.log('📊 综合评分公式分析')
    console.log('='.repeat(80))

    // 查找社区列表集合
    const communityCollection = data.collections.find((c: any) => c.name === '社区列表')

    if (!communityCollection) {
        console.log('❌ 未找到社区列表集合')
        return
    }

    // 查找综合评分字段
    const scoreField = Object.entries(communityCollection.schema).find(
        ([key, value]: [string, any]) => value.name === '综合评分'
    )

    if (!scoreField) {
        console.log('❌ 未找到综合评分字段')
        return
    }

    const [fieldId, fieldDef] = scoreField as [string, any]

    console.log('\n📋 字段基本信息:')
    console.log(`  - 字段 ID: ${fieldId}`)
    console.log(`  - 字段名称: ${fieldDef.name}`)
    console.log(`  - 字段类型: ${fieldDef.type}`)
    console.log(`  - 图标: ${fieldDef.icon || '无'}`)

    // 解析公式代码
    console.log('\n🔍 公式代码解析:')
    const formulaCode = fieldDef.formula2.code
    const formulaText = formulaCode.map((part: any) => {
        if (typeof part === 'string') {
            return part
        } else if (Array.isArray(part) && part[0] === '‣') {
            // 这是一个属性引用
            const propRef = part[1]?.[0]?.[1]
            if (propRef?.property) {
                // 查找属性名称
                const refProp = Object.entries(communityCollection.schema).find(
                    ([key]: [string, any]) => key === propRef.property
                )
                if (refProp) {
                    const [, refPropDef] = refProp as [string, any]
                    return `【${refPropDef.name}】`
                }
                return `【属性:${propRef.property}】`
            }
        }
        return ''
    }).join('')

    console.log('\n完整公式:')
    console.log(formulaText)

    // 提取关键信息
    console.log('\n📐 公式结构分析:')

    // 查找涉及的属性
    const referencedProps = new Set<string>()
    formulaCode.forEach((part: any) => {
        if (Array.isArray(part) && part[0] === '‣') {
            const propRef = part[1]?.[0]?.[1]
            if (propRef?.property) {
                referencedProps.add(propRef.property)
            }
        }
    })

    console.log('\n涉及的属性:')
    referencedProps.forEach(propId => {
        const prop = Object.entries(communityCollection.schema).find(
            ([key]: [string, any]) => key === propId
        )
        if (prop) {
            const [, propDef] = prop as [string, any]
            console.log(`  - ${propDef.name} (${propDef.type})`)
        }
    })

    // 简化的公式说明
    console.log('\n💡 公式说明:')
    console.log('  综合评分 = round(sum(硬件设施, 社区氛围, 交通便利, 周边环境) / 4, 1)')
    console.log('')
    console.log('  显示逻辑:')
    console.log('  - 如果没有评价: 显示 "暂无评价" (灰色加粗)')
    console.log('  - 如果有评价: 显示分数(橙色加粗) + 星级(★☆)')
    console.log('    * 实心星星(★): round(score) 个')
    console.log('    * 空心星星(☆): 10 - round(score) 个')

    // 查看实际数据示例
    console.log('\n📊 实际数据示例:')
    const samplePages = communityCollection.pages.slice(0, 5)

    samplePages.forEach((page: any, index: number) => {
        console.log(`\n  ${index + 1}. ${page.title}`)

        // 查找综合评分值
        const scoreValue = page.properties['综合评分']
        if (scoreValue) {
            console.log(`     综合评分: ${JSON.stringify(scoreValue.value)}`)
        } else {
            console.log(`     综合评分: (未计算)`)
        }

        // 显示各个维度的分数
        const dimensions = ['硬件设施', '社区氛围', '交通便利', '周边环境']
        dimensions.forEach(dim => {
            const dimValue = page.properties[dim]
            if (dimValue) {
                console.log(`     - ${dim}: ${dimValue.value}`)
            }
        })
    })

    console.log('\n' + '='.repeat(80))
}

analyzeScoreFormula()
