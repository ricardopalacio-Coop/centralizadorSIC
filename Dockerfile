FROM node:20-slim

# Instalar dependências necessárias para Chromium/Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    nss-plugin-pem \
    pango1.0-tools \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    python3 \
    python3-pip \
    python3-pypdf \
    --no-install-recommends \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && pip3 install --no-cache-dir --break-system-packages pymupdf \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copiar manifesto de dependências
COPY package*.json ./

# Instalar dependências de produção e dev para build
RUN npm install --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# Copiar código fonte
COPY . .

# Compilar servidor TypeScript e cliente React Vite
RUN npm run build

EXPOSE 3005

CMD ["node", "dist/server/index.js"]
