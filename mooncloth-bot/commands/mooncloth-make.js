var moment = require("moment");
const { createGUID } = require("../../custom-utils");
const {
  MOONCLOTH_CD_DAYS,
  EARLY_CD_REMINDER_DAYS,
  POST_CD_REMINDER_HOURS
} = require("../constants");

const { createLogger, format, transports } = require("winston");

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

exports.command = (bot, user, userID, channelID) => {
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

    const moonclothMessage = `Cooldown available on ${moonclothTimer.format(
      "LL LT"
    )}`;
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
};
