var moment = require("moment");
const { createLogger, format, transports } = require("winston");

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
};
