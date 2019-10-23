# use an existing docker image as base
FROM node:alpine

WORKDIR /usr/app

COPY ./ ./

# download and install a dependency
RUN npm install

# tell the image what to do when it starts as a container
CMD ["node", "bot.js"]