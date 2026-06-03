# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
# --host 0.0.0.0 pra ficar acessível fora do container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
