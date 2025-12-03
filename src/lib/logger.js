/**
 * @fileoverview This file configures the logger for the application.
 * @module lib/logger
 */

import { addColors, createLogger, format, transports } from 'winston'
import config from '../../config.js'
import { removeANSIFormatting } from '../util/utility.js'

const { NODE_ENV } = config

const levels = {
    levels: {
        error: 0,
        warn: 1,
        game: 2,
        info: 3,
        debug: 4
    },
    colors: {
        debug: 'cyan',
        info: 'white',
        game: 'green',
        error: 'red'
    }
}
addColors(levels.colors)
const logger = createLogger({
    levels: levels.levels,
    level: 'info',
    format: format.combine(
        format.json(),
        format.timestamp({
            format: () => {
                const date = new Date()
                const year = date.getFullYear()
                const month = (date.getMonth() + 1).toString().padStart(2, '0')
                const day = date.getDate().toString().padStart(2, '0')
                const hours = date.getHours().toString().padStart(2, '0')
                const minutes = date.getMinutes().toString().padStart(2, '0')
                const seconds = date.getSeconds().toString().padStart(2, '0')
                const milliseconds = date.getMilliseconds().toString().padStart(3, '0')
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
            }
        }),        format.printf(info => `${info.timestamp} ${info.level}: ${removeANSIFormatting(info.message)}`)
    ),
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/game.log', level: 'game' })
    ]
})

logger.add(new transports.Console({
    format: format.combine(
        format.colorize(),
        format.timestamp({
            format: () => {
                const date = new Date()
                const year = date.getFullYear()
                const month = (date.getMonth() + 1).toString().padStart(2, '0')
                const day = date.getDate().toString().padStart(2, '0')
                const hours = date.getHours().toString().padStart(2, '0')
                const minutes = date.getMinutes().toString().padStart(2, '0')
                const seconds = date.getSeconds().toString().padStart(2, '0')
                const milliseconds = date.getMilliseconds().toString().padStart(3, '0')
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
            }
        }),
        format.align(),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    )
}))

if (NODE_ENV === 'development') {
    logger.level = 'debug'
    logger.add(new transports.File({ filename: 'logs/debug.log' }))
}

export default logger
