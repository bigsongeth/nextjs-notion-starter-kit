import * as React from 'react'

import { getTextContent } from 'notion-utils'

import styles from './CustomFormulaRenderer.module.css'

/**
 * 自定义公式渲染器 - 专门处理综合评分等特殊公式字段
 */
export const CustomFormulaRenderer = ({
    schema,
    data,
    defaultFn
}: any) => {
    // 获取字段名称
    const fieldName = schema?.name || ''

    // 如果是综合评分字段，使用自定义渲染
    if (fieldName === '综合评分') {
        return renderScoreFormula(data)
    }

    // 如果是其他评分字段（硬件设施、社区氛围等），使用环形进度条渲染
    const scoreFields = ['硬件设施', '社区氛围', '交通便利', '周边环境']
    if (scoreFields.includes(fieldName)) {
        return renderRingScore(data, fieldName)
    }

    // 默认渲染 - 调用原始的默认函数
    return defaultFn ? defaultFn() : renderDefaultFormula(data)
}

/**
 * 渲染综合评分（带星级显示）
 */
function renderScoreFormula(data: any) {
    if (!data) {
        return (
            <span className={styles.noRating}>
                <span className={styles.noRatingText}>暂无评价</span>
            </span>
        )
    }

    // 尝试从 data 中提取文本内容
    const textContent = getTextContent(data)

    // 如果文本包含"暂无评价"
    if (textContent?.includes('暂无评价')) {
        return (
            <span className={styles.noRating}>
                <span className={styles.noRatingText}>暂无评价</span>
            </span>
        )
    }

    // 尝试解析分数
    const scoreMatch = textContent?.match(/(\d+\.?\d*)/)
    const score = scoreMatch?.[1] ? Number.parseFloat(scoreMatch[1]) : 0

    if (score === 0) {
        return (
            <span className={styles.noRating}>
                <span className={styles.noRatingText}>暂无评价</span>
            </span>
        )
    }

    // 计算星星数量
    const fullStars = Math.round(score)
    const emptyStars = 10 - fullStars

    return (
        <div className={styles.scoreContainer}>
            <span className={styles.scoreNumber}>{score.toFixed(1)}</span>
            <span className={styles.stars}>
                <span className={styles.fullStars}>{'★'.repeat(fullStars)}</span>
                <span className={styles.emptyStars}>{'☆'.repeat(emptyStars)}</span>
            </span>
        </div>
    )
}

/**
 * 渲染环形评分（用于单项评分）
 */
function renderRingScore(data: any, fieldName: string) {
    if (!data) {
        return <span className={styles.emptyScore}>-</span>
    }

    const textContent = getTextContent(data)
    const scoreMatch = textContent?.match(/(\d+\.?\d*)/)
    const score = scoreMatch?.[1] ? Number.parseFloat(scoreMatch[1]) : 0

    if (score === 0) {
        return <span className={styles.emptyScore}>-</span>
    }

    // 计算百分比（满分10分）
    const percentage = (score / 10) * 100

    return (
        <div className={styles.ringScoreContainer}>
            <div className={styles.ringProgress}>
                <svg width="40" height="40" viewBox="0 0 40 40">
                    {/* 背景圆环 */}
                    <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                    />
                    {/* 进度圆环 */}
                    <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="3"
                        strokeDasharray={`${percentage} 100`}
                        strokeLinecap="round"
                        transform="rotate(-90 20 20)"
                    />
                </svg>
                <span className={styles.ringScoreText}>{score.toFixed(1)}</span>
            </div>
            <span className={styles.ringScoreLabel}>{fieldName}</span>
        </div>
    )
}

/**
 * 默认公式渲染
 */
function renderDefaultFormula(data: any) {
    if (!data) {
        return null
    }

    const textContent = getTextContent(data)

    return <span>{textContent}</span>
}
