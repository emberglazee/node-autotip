const dotenv = require('dotenv')
const fs = require('fs')

if (fs.existsSync('.env')) dotenv.config()

const defaults = {
    NODE_ENV: 'production', // Change this to 'development' or run via `npm run dev` for more verbose logs

    TIP_KARMA: 500,      // Amount of karma gained for tipping a player, depends on player rank
    PRINT_REWARDS: true, // Whether tip rewards like coins and xp should be logged

    CHANGE_LANGUAGE: 'english', // Changes the Language to your preferred language (`/lang ${CHANGE_LANGUAGE}`)

    // Hiding messages options:
    HIDE_TIP_MESSAGES:      true, // Common errors (tipping, connection, AFK)
    HIDE_JOIN_MESSAGES:     true, // Friend/guild player joins
    HIDE_MVP_JOIN_MESSAGES: true, // MVP+ / MVP++ player joins
    HIDE_WATCHDOG_MESSAGES: true  // Watchdog messages
}

// ensure that process.env has all values in defaults, but prefer the process.env value
Object.keys(defaults).forEach(key => {
    process.env[key] = (key in process.env) ? process.env[key] : defaults[key]
})

if (process.argv.includes('--dev')) process.env.NODE_ENV = 'development'

// now processes can use either process.env or config
module.exports = process.env
