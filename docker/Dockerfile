FROM node:alpine
RUN apk add  --no-cache ffmpeg
WORKDIR /usr/src
COPY .. .
RUN npm install
CMD ["node", "."]
