FROM node:16-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /usr/src
COPY .. .

RUN npm install --legacy-peer-deps
CMD ["node", "."]
