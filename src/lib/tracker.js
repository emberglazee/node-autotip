/*
* Functions for tracking statistics
 */
const fs = require('fs').promises
const jsonfile = require('jsonfile')
const logger = require('./logger')

const trackerObj = {
    tips_sent: 0,
    tips_received: 0,
    exp: 0,
    karma: 0,
    coins: {}
}

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

async function tipIncrement(uuid, type, data) {
    const oldStats = await getStats(uuid)
    const newStats = updateStats(oldStats, data, type)
    await jsonfile.writeFile(`./stats/${uuid}/tips.json`, newStats)
}

async function getTipCount(uuid) {
    const stats = await getStats(uuid)
    return stats.tips_sent
}

async function getLifetimeStats(uuid) {
    const obj = await getStats(uuid)
    const xp = obj.exp || 0
    const karma = obj.karma || 0
    const coins = Object.values(obj.coins || {}).reduce((a, b) => a + b, 0)
    return { xp, karma, coins }
}

module.exports = {
    tipIncrement,
    getTipCount,
    getLifetimeStats
}
