import { promisify } from 'util'
import packageJson from '../../package.json' with { type: 'json' }

/**
 * Get a random integer between two values
 * @param {number} min The minimum value
 * @param {number} max The maximum value
 * @returns {number} A random integer
 */
export function getRndInteger(min, max) {
    return Math.floor(Math.random() * ((max - min) + 1)) + min
}

/**
 * The Mojang API requires UUIDs to be sent without dashes.
 * @param {string} string The string to remove dashes from
 * @returns {string} The string without dashes
 */
export function removeDashes(string) {
    return string.replace(/-/g, '')
}

/**
 * Converts Minecraft-style color codes to ANSI escape codes for console output.
 * @param {string} [src=''] The string to convert
 * @returns {string} The converted string
 */
export function toANSI(src = '') {
    const codes = {
        '§0': '\u001b[30m',
        '§1': '\u001b[34m',
        '§2': '\u001b[32m',
        '§3': '\u001b[36m',
        '§4': '\u001b[31m',
        '§5': '\u001b[35m',
        '§6': '\u001b[33m',
        '§7': '\u001b[37m',
        '§8': '\u001b[90m',
        '§9': '\u001b[94m',
        '§a': '\u001b[92m',
        '§b': '\u001b[96m',
        '§c': '\u001b[91m',
        '§d': '\u001b[95m',
        '§e': '\u001b[93m',
        '§f': '\u001b[97m',
        '§l': '\u001b[1m',
        '§o': '\u001b[3m',
        '§n': '\u001b[4m',
        '§m': '\u001b[9m',
        '§k': '\u001b[6m',
        '§r': '\u001b[0m'
    }
    let message = src
    Object.keys(codes).forEach(k => {
        message = message.replace(new RegExp(k, 'g'), codes[k])
    })
    return `${message}\u001b[0m`
}

/**
 * Removes ANSI formatting from a string, so that it can be written to a log file.
 * @param {string} string The string to remove ANSI formatting from
 * @returns {string} The string without ANSI formatting
 */
export function removeANSIFormatting(string) {
    return string.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

export const sleep = promisify(setTimeout)

export const headers = {
    'User-Agent': `@emberglazee/node-autotip@${packageJson.version}`
}
