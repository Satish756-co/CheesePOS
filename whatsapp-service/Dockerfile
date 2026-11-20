FROM node:20-slim

# Chromium dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js .

RUN mkdir -p sessions

EXPOSE 3001

CMD ["node", "server.js"]
