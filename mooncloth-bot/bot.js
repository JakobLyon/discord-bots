var Discord = require("discord.io");
var logger = require("winston");
var auth = require("./auth.json");
var moment = require("moment");
var _ = require("lodash");
const { createGUID } = require("../custom-utils");
const {
  MOONCLOTH_CD_DAYS,
  EARLY_CD_REMINDER_DAYS,
  POST_CD_REMINDER_HOURS,
  NO_COOLDOWN_USAGE,
  NOT_A_RECOGNIZED_COMMAND
} = require("./constants");

const { createLogger, format, transports } = require("winston");

const readDirFiles = require("read-dir-files");

let commands = [];

readDirFiles.list("commands", function(err, filenames) {
  if (err) return console.dir(err);
  commands = filenames
    .splice(1, filenames.length)
    .map(filename => filename.split("\\")[1])
    .map(filename => filename.split(".")[0])
    .reduce((acc, cur) => {
      return {
        ...acc,
        [cur]: require(`./commands/${cur}`)
      };
    }, {});
});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});
logger.level = "debug";

// Initialize Discord Bot
const bot = new Discord.Client({
  token: auth.token,
  autorun: true
});
bot.on("ready", function(evt) {
  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.username + " - (" + bot.id + ")");
});

bot.on("message", function(user, userID, channelID, message, evt) {
  // Our bot needs to know if it will execute a command
  // It will listen for messages that will start with `!`
  if (message.substring(0, 1) == "!") {
    const cmd = message.substring(1);

    // generated from readDirFiles
    if (Object.keys(commands).includes(cmd)) {
      commands[cmd](bot, user, userID, channelID);
    } else {
      bot.sendMessage({
        to: channelID,
        message: NOT_A_RECOGNIZED_COMMAND
      });
    }
  }
});
