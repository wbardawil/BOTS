# Stage 1: build the static bundle (Vite 8 needs Node 20.19+ / 22.12+).
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; else yarn install; fi

# Empty by default: the app then calls /api on its own origin and nginx proxies it (see nginx.conf).
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV DISABLE_EMERGENT_OVERLAY=true
COPY . .
RUN yarn build

# Stage 2: serve it.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
