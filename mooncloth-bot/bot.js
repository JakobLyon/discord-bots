var Discord = require("discord.io");
var logger = require("winston");
var auth = require("./auth.json");
var moment = require("moment");
var _ = require("lodash");
const { createGUID } = require("../custom-utils");
const {
  MOONCLOTH_CD_DAYS,
  EARLY_CD_REMINDER_DAYS,
  POST_CD_REMINDER_HOURS
} = require("./constants");

const { createLogger, format, transports } = require("winston");

const NO_COOLDOWN_USAGE = "No cooldown usage recorded";
const NOT_A_RECOGNIZED_COMMAND = "Not a recognized command";

const moonclothLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "mooncloth" },
  transports: [
    new transports.File({ filename: "mooncloth-error.log", level: "error" }),
    new transports.File({ filename: "mooncloth.log" })
  ]
});

const eventsLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "mooncloth" },
  transports: [
    new transports.File({ filename: "mooncloth-error.log", level: "error" }),
    new transports.File({ filename: "events.log" })
  ]
});

const eventCancelsLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "mooncloth" },
  transports: [
    new transports.File({ filename: "mooncloth-error.log", level: "error" }),
    new transports.File({ filename: "event-cancels.log" })
  ]
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

    switch (cmd) {
      case "ping":
        bot.sendMessage({
          to: channelID,
          message: "Pong!"
        });
        break;
      case "mooncloth make":
        // look up any future events for the user and cancel them
        new Promise((resolve, reject) => {
          const eventSearchOptions = {
            fields: [
              "userID",
              "id",
              "reminderTime",
              "channelID",
              "message",
              "reminderInterval",
              "type"
            ],
            from: moment().subtract(10, "days")
          };

          eventsLogger.query(eventSearchOptions, (err, results) => {
            const toDoEvents = results.file.filter(result => {
              return (
                moment(result.reminderTime).format("YYYYMMDDHHmmss") >
                  moment().format("YYYYMMDDHHmmss") && result.userID === userID
              );
            });

            const eventCancelsOptions = {
              fields: ["id"],
              from: moment().subtract(10, "days")
            };

            eventCancelsLogger.query(eventCancelsOptions, (err, results) => {
              const canceledEvents = results.file.map(result => result.id);

              toDoEvents.forEach(event => {
                if (!canceledEvents.includes(event.id)) {
                  // do event
                  bot.sendMessage({
                    to: event.channelID,
                    message: `<@${event.userID}>, reminder for ${moment(
                      event.reminderTime
                    ).format()} has been canceled`
                  });

                  // cancel event
                  eventCancelsLogger.info("", {
                    id: event.id,
                    userID: event.userID
                  });
                }
              });
            });
            resolve(true);
          });
        }).then(() => {
          const moonclothTimer = moment().add(MOONCLOTH_CD_DAYS, "days");
          const earlyReminder = moment(moonclothTimer).subtract(
            EARLY_CD_REMINDER_DAYS,
            "days"
          );
          const recurringReminder = moment(moonclothTimer).add(
            POST_CD_REMINDER_HOURS,
            "hours"
          );

          const moonclothMessage = `Cooldown available on ${moonclothTimer.format("LL LT")}`;
          moonclothLogger.info(moonclothMessage, {
            user,
            cooldownAvailable: moonclothTimer
          });
          // Early reminder
          eventsLogger.info({
            userID,
            message: `Your mooncloth will be ready to craft on ${earlyReminder.format(
              "LL"
            )} ${earlyReminder.format("LT")}`,
            reminderTime: earlyReminder.format(),
            id: createGUID(),
            channelID
          });
          // Off cd reminder
          eventsLogger.info({
            userID,
            message: `Your mooncloth is ready to craft!`,
            reminderTime: moonclothTimer.format(),
            id: createGUID(),
            channelID
          });
          // Late reminder
          eventsLogger.info({
            userID,
            message: `Your mooncloth is ready to craft!`,
            reminderTime: recurringReminder.format(),
            reminderInterval: 8,
            id: createGUID(),
            type: "recurring",
            channelID
          });
          bot.sendMessage({
            to: channelID,
            message: moonclothMessage
          });
        });

        break;
      case "mooncloth remind":
        const searchOptions = {
          fields: ["message", "user", "timestamp", "cooldownAvailable"],
          limit: 10,
          from: moment().subtract(30, "days")
        };
        moonclothLogger.query(searchOptions, (err, results) => {
          if (
            !results ||
            results.file.length === 0 ||
            !results.file.find(result => result.userID === userID)
          ) {
            bot.sendMessage({
              to: channelID,
              message: NO_COOLDOWN_USAGE
            });
            return;
          }

          const sortedAvailabilities = results.file
            .filter(result => result.user === user)
            .map(result => moment(result.cooldownAvailable))
            .sort(
              (a, b) => b.format("YYYYMMDDHHmmss") - a.format("YYYYMMDDHHmmss")
            );

          if (sortedAvailabilities.length === 0) {
            bot.sendMessage({
              to: channelID,
              message: NO_COOLDOWN_USAGE
            });
          }
          const nextCooldown = sortedAvailabilities[0];
          bot.sendMessage({
            to: channelID,
            message: `${user}, Your cooldown will be available on ${nextCooldown.format(
              "LL"
            )} at ${nextCooldown.format("LT")}`
          });
        });
        break;
      case "mooncloth cancel":
        const eventSearchOptions = {
          fields: [
            "userID",
            "id",
            "reminderTime",
            "channelID",
            "message",
            "reminderInterval",
            "type"
          ],
          from: moment().subtract(10, "days")
        };
        eventsLogger.query(eventSearchOptions, (err, results) => {
          const toDoEvents = results.file.filter(result => {
            return (
              moment(result.reminderTime).format("YYYYMMDDHHmmss") >
                moment().format("YYYYMMDDHHmmss") && result.userID === userID
            );
          });

          const eventCancelsOptions = {
            fields: ["id"],
            from: moment().subtract(10, "days")
          };

          eventCancelsLogger.query(eventCancelsOptions, (err, results) => {
            const canceledEvents = results.file.map(result => result.id);

            toDoEvents.forEach(event => {
              if (!canceledEvents.includes(event.id)) {
                // do event
                bot.sendMessage({
                  to: event.channelID,
                  message: `<@${event.userID}>, reminder for ${moment(
                    event.reminderTime
                  ).format("LL LT")} has been canceled`
                });

                // cancel event
                eventCancelsLogger.info("", {
                  id: event.id,
                  userID: event.userID
                });
              }
            });
          });
        });
        break;
      case "wow spreadsheet":
        bot.sendMessage({
          to: channelID,
          message:
            "<https://docs.google.com/spreadsheets/d/1UKJgaVZfbrHwDkmENme5Og5P6lFEJT3YK2M5wEUuL_Q/edit?usp=sharing>"
        });
        break;
      case "commands":
        bot.sendMessage({
          to: channelID,
          message: "mooncloth make, mooncloth remind, wow spreadsheet"
        });
        break;
      case "loop":
        bot.sendMessage({
          to: channelID,
          message: "!loop"
        });
        break;
      case "nobully":
        bot.sendMessage({
          to: channelID,
          message: "<:SpongebobMock:476443115251695638>"
        });
        break;
      case "dota":
        bot.sendMessage({
          to: channelID,
          message:
            "<@168905996276727818> <@100704042157621248> <@130151558129123329> <@184497414151995392> <@124027440958799872>"
        });
        break;
      case "pizza":
        bot.sendMessage({
          to: channelID,
          message: "<@87080793452613632>"
        });
        break;
      default:
        bot.sendMessage({
          to: channelID,
          message: NOT_A_RECOGNIZED_COMMAND
        });
    }
  }
});
