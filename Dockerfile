FROM node:20-alpine

# Install build dependencies required for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Expose the health check port from src/app.js
EXPOSE 3000

# Start the bot
CMD [ "npm", "start" ]
