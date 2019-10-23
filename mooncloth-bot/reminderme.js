var Discord = require("discord.io");
var logger = require("winston");
var auth = require("./auth.json");
var moment = require("moment");
const { createGUID } = require("./custom-utils");

const { createLogger, format, transports } = require("winston");

const remindmeLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "remindme" },
  transports: [
    new transports.File({
      filename: "./logs/remindme-error.log",
      level: "error"
    }),
    new transports.File({ filename: "./logs/remindme.log" })
  ]
});

const remindmeCancelsLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "remindme" },
  transports: [
    new transports.File({
      filename: "./logs/remindme-error.log",
      level: "error"
    }),
    new transports.File({ filename: "./logs/remindme-cancels.log" })
  ]
});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});
logger.level = "debug";
// Initialize Discord Bot
var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});
bot.on("ready", function(evt) {
  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.username + " - (" + bot.id + ")");
});

const eventCheckTimer = 1000;
const logsFromDays = 10;

setInterval(() => {
  // 1. check for events within gracePeriod
  // 2. for each event, if uncanceled, perform event
  // 3. cancel event
  const eventSearchOptions = {
    fields: [
      "userID",
      "id",
      "reminderTime",
      "channelID",
      "reminderName",
      "reminderInterval",
      "type"
    ],
    from: moment().subtract(logsFromDays, "days")
  };

  remindmeLogger.query(eventSearchOptions, (err, results) => {
    const toDoEvents = results.file.filter(result => {
      return (
        moment(result.reminderTime).format("YYYYMMDDHHmmss") <
        moment().format("YYYYMMDDHHmmss")
      );
    });

    const eventCancelsOptions = {
      fields: ["id"],
      from: moment().subtract(logsFromDays, "days")
    };

    remindmeCancelsLogger.query(eventCancelsOptions, (err, results) => {
      const canceledEvents = results.file.map(result => result.id);

      toDoEvents.forEach(event => {
        if (!canceledEvents.includes(event.id)) {
          // do event
          bot.sendMessage({
            to: event.channelID,
            message: `<@${event.userID}>, reminder for ${event.reminderName}!`
          });

          // cancel event
          remindmeCancelsLogger.info("", {
            id: event.id,
            userID: event.userID
          });

          // actions based on event type
          if (event.type === "recurring") {
            const intervalDays = event.reminderInterval.substring(0, 2);
            const intervalHours = event.reminderInterval.substring(2, 4);
            const intervalMinutes = event.reminderInterval.substring(4, 6);
            remindmeLogger.info("", {
              ...event,
              reminderTime: moment()
                .add(intervalDays, "days")
                .add(intervalHours, "hours")
                .add(intervalMinutes, "minutes"),
              id: createGUID()
            });
          }
        }
      });
    });
  });
}, eventCheckTimer);
