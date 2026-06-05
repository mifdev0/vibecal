FROM node:18-alpine

# Optimize production environment execution variables
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Leverage container caching layers for dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bring over functional code modules
COPY . .

EXPOSE 8080

# Run using a non-root privileged user account for cloud security compliance
USER node

CMD ["node", "server.js"]
