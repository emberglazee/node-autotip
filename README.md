<img src="https://repository-images.githubusercontent.com/124889265/21280080-7431-11e9-92d0-2a2eefcc1051" alt="node-autotip"/>

# node-autotip v4.7.1

A fork of [builder-247](https://github.com/builder-247)'s [node-autotip](https://github.com/builder-247/node-autotip) project, with updated packages and a refactored code base.

## About

node-autotip is command-line based version of the Forge mod [Autotip](https://github.com/Semx11/Autotip) (by [Semx11](https://hypixel.net/members/semx11.20123), [2Pi](https://hypixel.net/members/2pi.22108) and [Sk1er](https://hypixel.net/members/sk1er.199731)).
It is useful for long afk sessions, e.g. overnight. You can even run it on Android with Termux.

Advantage of using node-autotip instead of the official mod is greatly smaller electricity costs, as it doesn't require any game rendering. This is achieved by communicating with the server directly using minecraft's protocol.

node-autotip also fixes the issue of "That player is not online, try another user!", making it more efficient than the original mod.

## Getting started

1. Install [Node.js](https://nodejs.org/en/), atleast v18, but >=v22 is recommended;
    * Also tested to be working with [Bun](https://bun.sh/), you may chose it over Node.js if you wish.
2. Clone or download the project;
3. Run `npm install` command in the project directory;
4. Create a credentials.json file following [this example](https://github.com/emberglazee/node-autotip/blob/master/credentials.example.json);
    * To track when you log into Hypixel and not try to reconnect while you're playing, please set the `apiKey`, you can get it here: https://developer.hypixel.net/; This way the bot will check your status every 5 minutes and only reconnect once you're offline.
    * **OPTIONAL**: Create `.env` file with config values in KEY=VALUE format (see config.js for full listing of options).
        * In order to track karma gain accurately, update the `TIP_KARMA` value, it is 100 for default rank, 200 for VIP etc. capped at 500 for MVP+.
5. `npm start` to start node-autotip;
6. `npm run stats` to display node-autotip statistics.

## Contributing

We would love to have your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

* Reporting a bug (make a [github issue](https://github.com/emberglazee/node-autotip/issues/new))
* Discussing the current state of the code
* Submitting a fix (fork and [pull](https://github.com/emberglazee/node-autotip/compare) as explained below)
* Proposing new features (mention it on github or make a [github issue](https://github.com/emberglazee/node-autotip/issues/new))

### Developing

In order to see debugging output, set the `NODE_ENV` variable to `development` in your .env file.
