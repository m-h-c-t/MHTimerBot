# MHTimerBot
Discord bot that understands mousehunt timers and MouseHunt Community Tools (MHCT) and a few other things about life.

## Needs
Next big push is make things into slash commands.

## Commands

* help \<command\> / `/help` - Lists commands or displays help for one command; supports optional command autocomplete and public response
* next \<area\> / `/next` - displays when the next timer occurs; slash replies are private by default, with an optional public response
  -next spill: The levels will rise to Arch in 2h31m
* remind \<area\> [sub-area] [always|once|stop|<num>] / `/remind` - Sets, stops, or lists timer reminders (slash `count`: 1 by default, 0 to stop, -1 for always)
  -remind season once - Will only remind the next time the timer goes
  -remind season winter once - Will only remind the next time the timer goes
* schedule \<area\> [\<number\>] / `/schedule` - Shows upcoming timers; slash options filter by area, sub-area, and hours
  -schedule spill 2 - The levels will rise to Arch in 2h31m / The levels will fall through Arch in 1d2h31m
* find \<mouse\> - Finds a mouse using MHCT data. You need up to three characters of the start of the mouse's name
  -find Ful'mina OR -find ful
* ifind \<loot\> (`-mh ifind`) / `/find-loot` - Finds a loot drop using MHCT data. You need up to three characters of the loot's name
  -ifind tooth
* whatsin \<convertible\> / `/whatsin` - Displays items found in a convertible
  -whatsin arduous
* minluck \<mouse\> - Displays a mouse's minluck values
  -minluck Ful'mina OR -minluck ful
* config / `/config` - Bot and server owner, mostly. Allows server admins to view or change roles, prefixes, timer channels, and emoji settings
* shutdown / `/shutdown` - Gracefully saves data and shuts down the bot; owner only

Slash commands default to private (ephemeral) replies. Set the `public` option to `true` to make a reply visible in the channel; public list and table results show up to 10 entries, or all 11 when exactly 11 match. Longer lists show the first 10 followed by `(...and more)`. `/config` returns all configured values.

`/config` provides `view`, `adminrole`, `modrole`, `prefix`, `timers`, `timers-add`, `timers-remove`, `emoji`, `emoji-get`, `emoji-set`, and `emoji-remove` subcommands. Each supports the optional `public` response setting.

## To use with your own discord server

Note: If you just want to use existing bot on your own discord server, ask Aardwolf if you can join our bot testing. Otherwise, these instructions are to host your own copy of the bot, so you can help us develop and customize it.

Note: The slash commands should work, everything else is buggy right now. Please submit your feedback or questions in the official MH Discord Comm Tools thread.

1. Log into discord in a browser and create a discord bot account [like this](https://discordpy.readthedocs.io/en/stable/discord.html)
2. In the [bot account settings](https://discord.com/developers/applications):
    * Under Bot tab: Ensure that the [Message Content intent](https://support-dev.discord.com/hc/en-us/articles/4404772028055) is enabled.
    * Under Oath2->Url Generator: Add the following permissions and open the new generated url to invite the bot to your server
        * View Channels
        * Send Messages
        * Send Messages in Threads (if you use threads on your server)
        * Embed Links
        * Add Reactions
        * Read Message History
        * Use Application Commands
3. Invide the bot to any private channels from that channel settings
4. Clone this repo to your server and cd into that new directory
5. Modify the `data/settings.json` (copy it from the sample file provided there):
    * token (REQUIRED) - this is your bot token
    * owner ID (REQUIRED) - this is your discord numerical id
    * requestPrivilegedIntents (optional, default: `true`) - set to `false` if this bot cannot use the message intents; when disabled, the bot does not request guild messages, guild message reactions, or message content
    * timedAnnouncementsChannel - the name of the channel to announce timers in (default: timers)
    * botPrefix - the prefix for the bot's commands (default: -mh)
    * `bot_emoji` - optional emoji defaults used by commands such as `minluck`, `price` (`sb`), and the Super Brie value summary in `/whatsin`. If you upload custom emojis to your self-hosted bot, set each value to its Discord emoji markup, such as `<:arcane:123456789012345678>`. Guild-specific emoji configured with `/config emoji-set` override these defaults; omitted keys use the built-in text labels.
    * Server-specific settings are created automatically when the bot joins a server. Timer announcements are disabled until an admin configures channels with `/config timers-add`.
6. Make sure you have nodejs (minimum v16.15) and npm installed
7. Run `npm install` inside the repo folder
8. Run `node src/MHTimer.js` to start the bot or `nohup node src/MHTimers.js >error.log 2>&1 &` to run it in background.
