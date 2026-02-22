FROM node:20-alpine

# Устанавливаем зависимости для Prisma
RUN apk add --no-cache openssl bash curl

WORKDIR /app

# Копируем package.json + lock
COPY package*.json ./

# Устанавливаем зависимости Node и Prisma
RUN npm install

# Копируем код
COPY . .

# Генерация Prisma клиент
RUN npx prisma generate

# Сборка TypeScript
RUN npm run build

EXPOSE 4000

# Создаем скрипт запуска с миграциями
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🔄 Running database migrations..."' >> /app/start.sh && \
    echo 'npx prisma migrate deploy' >> /app/start.sh && \
    echo 'echo "✅ Migrations completed"' >> /app/start.sh && \
    echo 'echo "🚀 Starting server..."' >> /app/start.sh && \
    echo 'npm run start' >> /app/start.sh && \
    chmod +x /app/start.sh

CMD ["/app/start.sh"]
