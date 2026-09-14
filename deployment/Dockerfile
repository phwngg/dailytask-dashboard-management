FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.27-alpine AS build
RUN apk add --no-cache build-base
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o /out/api .
COPY --from=web /src/frontend/dist /out/static

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && addgroup -S -g 10001 app && adduser -S -D -H -u 10001 -G app app && mkdir -p /data /app/static && chown -R app:app /data /app
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build --chown=app:app /out/static /app/static
USER app
ENV PORT=8080 DATABASE_PATH=/data/dailytask.db STATIC_DIR=/app/static
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["/app/api"]
