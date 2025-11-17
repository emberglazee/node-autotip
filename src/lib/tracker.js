/**
 * @fileoverview Functions for tracking statistics about tips, such as how many
 * tips have been sent and received, and how much EXP, Karma, and coins have been
 * earned. This data is persisted to a JSON file.
 * @module lib/tracker
 */
import fs from 'fs/promises'
import jsonfile from 'jsonfile'
import logger from './logger.js'

const trackerObj = {
    username: '',
    tips_sent: 0,
    tips_received: 0,
    exp: 0,
    karma: 0,
    coins: {}
}

/**
 * Creates a directory for a player's stats if it does not already exist.
 * @param {string} dirPath The path to the directory
 */
async function createDirIfNotExist(dirPath) {
    try {
        await fs.access(dirPath)
    } catch (e) {
        await fs.mkdir(dirPath, { recursive: true })
    }

    const statsPath = `${dirPath}/tips.json`
    try {
        await fs.access(statsPath)
    } catch (e) {
        await jsonfile.writeFile(statsPath, trackerObj)
    }
}

/**
 * Gets the stats for a player from the JSON file.
 * @param {string} uuid The UUID of the player
 * @returns {Promise<object>} The stats object
 */
async function getStats(uuid) {
    const path = `./stats/${uuid}/tips.json`
    await createDirIfNotExist(`./stats/${uuid}`)
    try {
        return await jsonfile.readFile(path)
    } catch (err) {
        logger.error(err)
        return trackerObj // Return default object on error
    }
}

/**
 * Updates the stats object with new data from a tip.
 * @param {object} obj The stats object to update
 * @param {string[]} data The data from the tip message
 * @param {object} tip The tip object
 * @returns {object} The updated stats object
 */
function updateStats(obj, data, tip) {
    const stats = { ...obj }
    const xpRegex = /\+([\d]*) Hypixel Experience/
    const karmaRegex = /\+([\d]*) Karma/
    const coinRegex = /\+([\d]*) ([\w\s]+) Coins/

    if (tip.type === 'sent') {
        stats.tips_sent += Number(tip.amount)
    } else {
        stats.tips_received += Number(tip.amount)
    }

    data.forEach(entry => {
        switch (true) {
            case xpRegex.test(entry):
                stats.exp += Number(xpRegex.exec(entry)[1])
                break
            case karmaRegex.test(entry):
                stats.karma += Number(karmaRegex.exec(entry)[1])
                break
            case coinRegex.test(entry): {
                const [, coins, game] = coinRegex.exec(entry)
                stats.coins[game] = (stats.coins[game] || 0) + Number(coins)
                break
            }
        }
    })
    return stats
}

/**
 * Increments the tip stats and saves them to the JSON file.
 * @param {string} uuid The UUID of the player
 * @param {string} username The username of the player
 * @param {object} type The type of tip
 * @param {string[]} data The data from the tip message
 */
export async function tipIncrement(uuid, username, type, data) {
    const oldStats = await getStats(uuid)
    const newStats = updateStats(oldStats, data, type)
    newStats.username = username
    await jsonfile.writeFile(`./stats/${uuid}/tips.json`, newStats)
}

/**
 * Gets the number of tips sent by a player, which is needed to log in to the
 * autotip server.
 * @param {string} uuid The UUID of the player
 * @returns {Promise<number>} The number of tips sent
 */
export async function getTipCount(uuid) {
    const stats = await getStats(uuid)
    return stats.tips_sent
}

/**
 * Gets the lifetime stats for a player to display on login.
 * @param {string} uuid The UUID of the player
 * @returns {Promise<object>} The lifetime stats object
 */
export async function getLifetimeStats(uuid) {
    const obj = await getStats(uuid)
    const xp = obj.exp ?? 0
    const karma = obj.karma ?? 0
    const coins = Object.values(obj.coins || {}).reduce((a, b) => a + b, 0)
    return { xp, karma, coins }
}
